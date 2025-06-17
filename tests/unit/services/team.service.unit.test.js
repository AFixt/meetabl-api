/**
 * Team service unit tests
 *
 * Tests for team management business logic
 *
 * @author meetabl Team
 */

// Import test setup
require('../test-setup');

// Mock dependencies
jest.mock('../../../src/models', () => ({
  Team: {
    create: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  },
  TeamMember: {
    create: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  },
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn()
  },
  AuditLog: {
    create: jest.fn()
  }
}));

jest.mock('../../../src/config/database', () => ({
  sequelize: {
    transaction: jest.fn()
  },
  Op: {
    ne: 'ne',
    in: 'in',
    or: 'or'
  }
}));

jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Import service after mocks
const teamService = require('../../../src/services/team.service');
const { Team, TeamMember, User, AuditLog } = require('../../../src/models');
const { sequelize } = require('../../../src/config/database');

describe('Team Service', () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock transaction
    mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn()
    };
    sequelize.transaction.mockResolvedValue(mockTransaction);
  });

  describe('createTeam', () => {
    test('should create team successfully', async () => {
      // Mock team creation
      const mockTeam = {
        id: 'team-id',
        name: 'Test Team',
        description: 'Test Description',
        owner_id: 'user-id'
      };
      Team.create.mockResolvedValueOnce(mockTeam);

      // Mock team member creation
      TeamMember.create.mockResolvedValueOnce({
        team_id: 'team-id',
        user_id: 'user-id',
        role: 'admin'
      });

      // Mock audit log creation
      AuditLog.create.mockResolvedValueOnce({});

      // Mock team with owner info
      const mockCreatedTeam = {
        ...mockTeam,
        owner: { id: 'user-id', name: 'User' }
      };
      Team.findByPk.mockResolvedValueOnce(mockCreatedTeam);

      // Execute service
      const result = await teamService.createTeam('user-id', {
        name: 'Test Team',
        description: 'Test Description'
      });

      // Verify team creation
      expect(Team.create).toHaveBeenCalledWith({
        name: 'Test Team',
        description: 'Test Description',
        owner_id: 'user-id'
      }, { transaction: mockTransaction });

      // Verify team member creation
      expect(TeamMember.create).toHaveBeenCalledWith({
        team_id: 'team-id',
        user_id: 'user-id',
        role: 'admin'
      }, { transaction: mockTransaction });

      // Verify audit log creation
      expect(AuditLog.create).toHaveBeenCalledWith({
        user_id: 'user-id',
        action: 'team_created',
        resource_type: 'team',
        resource_id: 'team-id',
        details: { team_name: 'Test Team' }
      }, { transaction: mockTransaction });

      // Verify transaction commit
      expect(mockTransaction.commit).toHaveBeenCalled();

      // Verify result
      expect(result).toEqual(mockCreatedTeam);
    });

    test('should rollback transaction on error', async () => {
      // Mock team creation error
      Team.create.mockRejectedValueOnce(new Error('Database error'));

      // Execute service and expect error
      await expect(teamService.createTeam('user-id', {
        name: 'Test Team'
      })).rejects.toThrow('Database error');

      // Verify transaction rollback
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('getUserTeams', () => {
    test('should get user teams successfully', async () => {
      // Mock teams data
      const mockTeams = {
        rows: [
          {
            id: 'team-1',
            name: 'Team 1',
            members: [{ role: 'admin' }],
            owner: { id: 'user-id', name: 'User' }
          }
        ],
        count: 1
      };
      Team.findAndCountAll.mockResolvedValueOnce(mockTeams);

      // Execute service
      const result = await teamService.getUserTeams('user-id');

      // Verify database query
      expect(Team.findAndCountAll).toHaveBeenCalledWith({
        include: [
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'name', 'email']
          },
          {
            model: TeamMember,
            as: 'members',
            where: { user_id: 'user-id' },
            attributes: ['role', 'joined_at'],
            required: true
          }
        ],
        limit: 100,
        offset: 0,
        order: [['created', 'DESC']],
        distinct: true
      });

      // Verify result
      expect(result).toEqual({
        teams: mockTeams.rows,
        total: mockTeams.count,
        limit: 100,
        offset: 0
      });
    });

    test('should handle database errors', async () => {
      // Mock database error
      Team.findAndCountAll.mockRejectedValueOnce(new Error('Database error'));

      // Execute service and expect error
      await expect(teamService.getUserTeams('user-id')).rejects.toThrow('Database error');
    });
  });

  describe('getTeamById', () => {
    test('should get team successfully for team member', async () => {
      // Mock team data
      const mockTeam = {
        id: 'team-id',
        name: 'Test Team',
        members: [{ user_id: 'user-id' }],
        owner: { id: 'owner-id', name: 'Owner' }
      };
      Team.findByPk.mockResolvedValueOnce(mockTeam);

      // Execute service
      const result = await teamService.getTeamById('team-id', 'user-id');

      // Verify database query
      expect(Team.findByPk).toHaveBeenCalledWith('team-id', {
        include: [
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'name', 'email']
          },
          {
            model: TeamMember,
            as: 'members',
            include: [
              {
                model: User,
                attributes: ['id', 'name', 'email']
              }
            ]
          }
        ]
      });

      // Verify result
      expect(result).toEqual(mockTeam);
    });

    test('should throw error for non-existent team', async () => {
      // Mock team not found
      Team.findByPk.mockResolvedValueOnce(null);

      // Execute service and expect error
      await expect(teamService.getTeamById('non-existent-id', 'user-id')).rejects.toThrow('Team not found');
    });

    test('should throw error for unauthorized access', async () => {
      // Mock team without user membership
      const mockTeam = {
        id: 'team-id',
        name: 'Test Team',
        members: [{ user_id: 'other-user' }],
        owner: { id: 'owner-id' }
      };
      Team.findByPk.mockResolvedValueOnce(mockTeam);

      // Execute service and expect error
      await expect(teamService.getTeamById('team-id', 'unauthorized-user')).rejects.toThrow('Access denied');
    });
  });

  describe('getTeamMembers', () => {
    test('should get team members successfully', async () => {
      // Mock membership check
      TeamMember.findOne.mockResolvedValueOnce({ role: 'member' });

      // Mock members data
      const mockMembers = {
        rows: [
          {
            id: 'member-1',
            role: 'admin',
            User: { id: 'user-1', name: 'Admin User' }
          }
        ],
        count: 1
      };
      TeamMember.findAndCountAll.mockResolvedValueOnce(mockMembers);

      // Execute service
      const result = await teamService.getTeamMembers('team-id', 'user-id');

      // Verify membership check
      expect(TeamMember.findOne).toHaveBeenCalledWith({
        where: {
          team_id: 'team-id',
          user_id: 'user-id'
        }
      });

      // Verify members query
      expect(TeamMember.findAndCountAll).toHaveBeenCalledWith({
        where: { team_id: 'team-id' },
        include: [{
          model: User,
          attributes: ['id', 'name', 'email']
        }],
        limit: 100,
        offset: 0,
        order: [['joined_at', 'ASC']]
      });

      // Verify result
      expect(result).toEqual({
        members: mockMembers.rows,
        total: mockMembers.count,
        limit: 100,
        offset: 0
      });
    });

    test('should throw error for non-member', async () => {
      // Mock no membership
      TeamMember.findOne.mockResolvedValueOnce(null);

      // Execute service and expect error
      await expect(teamService.getTeamMembers('team-id', 'non-member-id')).rejects.toThrow('Access denied');
    });
  });
});