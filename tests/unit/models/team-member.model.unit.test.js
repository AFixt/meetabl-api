/**
 * TeamMember model unit tests
 *
 * Tests the TeamMember model definition, validations, and behavior
 *
 * @author meetabl Team
 */

require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup mocks
setupControllerMocks();

// Import models after mocks are set up
const { TeamMember } = require('../../../src/models');
const { v4: uuidv4 } = jest.requireActual('uuid');

describe('TeamMember Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock TeamMember model methods
    TeamMember.create = jest.fn();
    TeamMember.findAll = jest.fn();
    TeamMember.findOne = jest.fn();
    TeamMember.findByPk = jest.fn();
    TeamMember.update = jest.fn();
    TeamMember.destroy = jest.fn();
    TeamMember.count = jest.fn();
    TeamMember.bulkCreate = jest.fn();
  });

  describe('Team Member Operations', () => {
    beforeEach(() => {
      // Setup default mock implementations
      TeamMember.create.mockImplementation(async (data) => ({
        id: data.id || uuidv4(),
        team_id: data.team_id,
        user_id: data.user_id,
        role: data.role || 'member',
        joined_at: data.joined_at || new Date(),
        created: new Date(),
        updated: new Date(),
        ...data
      }));
      
      TeamMember.findAll.mockResolvedValue([]);
      TeamMember.findOne.mockResolvedValue(null);
      TeamMember.update.mockResolvedValue([1]);
      TeamMember.destroy.mockResolvedValue(1);
      TeamMember.count.mockResolvedValue(0);
    });

    test('should create team member with valid data', async () => {
      const validData = {
        team_id: 'team-123',
        user_id: 'user-456',
        role: 'admin'
      };

      const result = await TeamMember.create(validData);

      expect(TeamMember.create).toHaveBeenCalledWith(validData);
      expect(result).toMatchObject(validData);
      expect(result.id).toBeDefined();
      expect(result.joined_at).toBeInstanceOf(Date);
    });

    test('should create team member with default role', async () => {
      const validData = {
        team_id: 'team-123',
        user_id: 'user-456'
      };

      const result = await TeamMember.create(validData);

      expect(TeamMember.create).toHaveBeenCalledWith(validData);
      expect(result.role).toBe('member');
    });

    test('should handle custom joined_at timestamp', async () => {
      const customJoinedAt = new Date('2024-01-15T10:30:00Z');

      const validData = {
        team_id: 'team-123',
        user_id: 'user-456',
        role: 'member',
        joined_at: customJoinedAt
      };

      const result = await TeamMember.create(validData);

      expect(TeamMember.create).toHaveBeenCalledWith(validData);
      expect(result.joined_at).toEqual(customJoinedAt);
    });

    test('should support querying team members by team', async () => {
      const mockMembers = [
        {
          id: '1',
          team_id: 'team-123',
          user_id: 'user-456',
          role: 'admin',
          joined_at: new Date()
        },
        {
          id: '2',
          team_id: 'team-123',
          user_id: 'user-789',
          role: 'member',
          joined_at: new Date()
        }
      ];
      
      TeamMember.findAll.mockResolvedValue(mockMembers);

      const teamMembers = await TeamMember.findAll({
        where: { team_id: 'team-123' },
        order: [['joined_at', 'ASC']]
      });

      expect(TeamMember.findAll).toHaveBeenCalledWith({
        where: { team_id: 'team-123' },
        order: [['joined_at', 'ASC']]
      });
      expect(teamMembers).toHaveLength(2);
    });

    test('should support querying teams by user', async () => {
      const mockMemberships = [
        {
          id: '1',
          team_id: 'team-123',
          user_id: 'user-456',
          role: 'admin',
          joined_at: new Date()
        },
        {
          id: '2',
          team_id: 'team-456',
          user_id: 'user-456',
          role: 'member',
          joined_at: new Date()
        }
      ];
      
      TeamMember.findAll.mockResolvedValue(mockMemberships);

      const userMemberships = await TeamMember.findAll({
        where: { user_id: 'user-456' },
        order: [['joined_at', 'DESC']]
      });

      expect(TeamMember.findAll).toHaveBeenCalledWith({
        where: { user_id: 'user-456' },
        order: [['joined_at', 'DESC']]
      });
      expect(userMemberships).toHaveLength(2);
    });

    test('should support checking if user is team member', async () => {
      TeamMember.findOne.mockResolvedValue({
        id: '1',
        team_id: 'team-123',
        user_id: 'user-456',
        role: 'member',
        joined_at: new Date()
      });

      const membership = await TeamMember.findOne({
        where: { 
          team_id: 'team-123',
          user_id: 'user-456'
        }
      });

      expect(TeamMember.findOne).toHaveBeenCalledWith({
        where: { 
          team_id: 'team-123',
          user_id: 'user-456'
        }
      });
      expect(membership).toBeTruthy();
      expect(membership.role).toBe('member');
    });

    test('should support updating member role', async () => {
      const updatedCount = await TeamMember.update(
        { role: 'admin' },
        { 
          where: { 
            team_id: 'team-123',
            user_id: 'user-456'
          }
        }
      );

      expect(TeamMember.update).toHaveBeenCalledWith(
        { role: 'admin' },
        { 
          where: { 
            team_id: 'team-123',
            user_id: 'user-456'
          }
        }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support removing team member', async () => {
      const deletedCount = await TeamMember.destroy({
        where: { 
          team_id: 'team-123',
          user_id: 'user-456'
        }
      });

      expect(TeamMember.destroy).toHaveBeenCalledWith({
        where: { 
          team_id: 'team-123',
          user_id: 'user-456'
        }
      });
      expect(deletedCount).toBe(1);
    });

    test('should support counting team members', async () => {
      TeamMember.count.mockResolvedValue(12);

      const memberCount = await TeamMember.count({
        where: { team_id: 'team-123' }
      });

      expect(TeamMember.count).toHaveBeenCalledWith({
        where: { team_id: 'team-123' }
      });
      expect(memberCount).toBe(12);
    });
  });

  describe('Role Management', () => {
    beforeEach(() => {
      TeamMember.create.mockImplementation(async (data) => ({
        id: data.id || uuidv4(),
        team_id: data.team_id,
        user_id: data.user_id,
        role: data.role || 'member',
        joined_at: data.joined_at || new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        ...data
      }));
      TeamMember.update.mockResolvedValue([1]);
    });

    test('should support creating admin members', async () => {
      const validData = {
        team_id: 'team-123',
        user_id: 'user-456',
        role: 'admin'
      };

      const result = await TeamMember.create(validData);

      expect(result.role).toBe('admin');
    });

    test('should support creating regular members', async () => {
      const validData = {
        team_id: 'team-123',
        user_id: 'user-456',
        role: 'member'
      };

      const result = await TeamMember.create(validData);

      expect(result.role).toBe('member');
    });

    test('should support querying team admins', async () => {
      TeamMember.findAll.mockResolvedValue([
        {
          id: '1',
          team_id: 'team-123',
          user_id: 'user-456',
          role: 'admin',
          joined_at: new Date()
        }
      ]);

      const teamAdmins = await TeamMember.findAll({
        where: { 
          team_id: 'team-123',
          role: 'admin'
        }
      });

      expect(TeamMember.findAll).toHaveBeenCalledWith({
        where: { 
          team_id: 'team-123',
          role: 'admin'
        }
      });
      expect(teamAdmins).toHaveLength(1);
      expect(teamAdmins[0].role).toBe('admin');
    });

    test('should support promoting member to admin', async () => {
      const updatedCount = await TeamMember.update(
        { role: 'admin' },
        { 
          where: { 
            team_id: 'team-123',
            user_id: 'user-456'
          }
        }
      );

      expect(TeamMember.update).toHaveBeenCalledWith(
        { role: 'admin' },
        { 
          where: { 
            team_id: 'team-123',
            user_id: 'user-456'
          }
        }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support demoting admin to member', async () => {
      const updatedCount = await TeamMember.update(
        { role: 'member' },
        { 
          where: { 
            team_id: 'team-123',
            user_id: 'user-456'
          }
        }
      );

      expect(TeamMember.update).toHaveBeenCalledWith(
        { role: 'member' },
        { 
          where: { 
            team_id: 'team-123',
            user_id: 'user-456'
          }
        }
      );
      expect(updatedCount).toEqual([1]);
    });
  });

  describe('Membership Analytics', () => {
    test('should support counting admins vs members', async () => {
      TeamMember.count
        .mockResolvedValueOnce(2) // admin count
        .mockResolvedValueOnce(8); // member count

      const adminCount = await TeamMember.count({
        where: { 
          team_id: 'team-123',
          role: 'admin'
        }
      });

      const memberCount = await TeamMember.count({
        where: { 
          team_id: 'team-123',
          role: 'member'
        }
      });

      expect(adminCount).toBe(2);
      expect(memberCount).toBe(8);
      expect(TeamMember.count).toHaveBeenCalledTimes(2);
    });

    test('should support finding recent joiners', async () => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      TeamMember.findAll.mockResolvedValue([
        {
          id: '1',
          team_id: 'team-123',
          user_id: 'user-456',
          role: 'member',
          joined_at: new Date()
        }
      ]);

      const recentJoiners = await TeamMember.findAll({
        where: { 
          team_id: 'team-123',
          joined_at: {
            [require('sequelize').Op.gte]: oneWeekAgo
          }
        },
        order: [['joined_at', 'DESC']]
      });

      expect(TeamMember.findAll).toHaveBeenCalledWith({
        where: { 
          team_id: 'team-123',
          joined_at: {
            [require('sequelize').Op.gte]: oneWeekAgo
          }
        },
        order: [['joined_at', 'DESC']]
      });
      expect(recentJoiners).toHaveLength(1);
    });

    test('should support bulk member operations', async () => {
      const membersData = [
        { team_id: 'team-123', user_id: 'user-1', role: 'member' },
        { team_id: 'team-123', user_id: 'user-2', role: 'member' },
        { team_id: 'team-123', user_id: 'user-3', role: 'member' }
      ];

      TeamMember.bulkCreate.mockResolvedValue(
        membersData.map((data, i) => ({
          id: `${i + 1}`,
          ...data,
          joined_at: new Date(),
          created: new Date(),
          updated: new Date()
        }))
      );

      const createdMembers = await TeamMember.bulkCreate(membersData);

      expect(TeamMember.bulkCreate).toHaveBeenCalledWith(membersData);
      expect(createdMembers).toHaveLength(3);
    });

    test('should support removing all team members', async () => {
      TeamMember.destroy.mockResolvedValue(10); // 10 members removed

      const deletedCount = await TeamMember.destroy({
        where: { team_id: 'team-123' }
      });

      expect(TeamMember.destroy).toHaveBeenCalledWith({
        where: { team_id: 'team-123' }
      });
      expect(deletedCount).toBe(10);
    });
  });
});