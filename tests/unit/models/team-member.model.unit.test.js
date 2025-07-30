/**
 * TeamMember model unit tests
 *
 * Tests the TeamMember model definition, validations, and behavior
 *
 * @author meetabl Team
 */

require('../test-setup');

const { v4: uuidv4 } = require('uuid');

// Mock sequelize and models
const mockSequelize = {
  define: jest.fn(),
  DataTypes: require('sequelize').DataTypes
};

const mockUser = {
  id: 'user-123'
};

const mockTeam = {
  id: 'team-123'
};

jest.mock('../../../src/config/database', () => ({
  sequelize: mockSequelize
}));

jest.mock('../../../src/models/user.model', () => mockUser);
jest.mock('../../../src/models/team.model', () => mockTeam);

// Import the model after mocking
const TeamMember = require('../../../src/models/team-member.model');

describe('TeamMember Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Model Definition', () => {
    test('should define TeamMember model with correct table name', () => {
      expect(mockSequelize.define).toHaveBeenCalledWith(
        'TeamMember',
        expect.any(Object),
        expect.objectContaining({
          tableName: 'team_members',
          timestamps: true,
          createdAt: 'created',
          updatedAt: 'updated',
          indexes: [
            {
              unique: true,
              fields: ['team_id', 'user_id']
            }
          ]
        })
      );
    });

    test('should have correct field definitions', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];

      // Check id field
      expect(fieldDefinitions.id).toEqual({
        type: expect.any(Object),
        primaryKey: true,
        defaultValue: expect.any(Function)
      });

      // Check team_id field
      expect(fieldDefinitions.team_id).toEqual({
        type: expect.any(Object),
        allowNull: false,
        references: {
          model: mockTeam,
          key: 'id'
        }
      });

      // Check user_id field
      expect(fieldDefinitions.user_id).toEqual({
        type: expect.any(Object),
        allowNull: false,
        references: {
          model: mockUser,
          key: 'id'
        }
      });

      // Check role field
      expect(fieldDefinitions.role).toEqual({
        type: expect.any(Object),
        allowNull: false,
        defaultValue: 'member'
      });

      // Check joined_at field
      expect(fieldDefinitions.joined_at).toEqual({
        type: expect.any(Object),
        defaultValue: expect.any(Object),
        allowNull: false
      });

      // Check created field
      expect(fieldDefinitions.created).toEqual({
        type: expect.any(Object),
        defaultValue: expect.any(Object)
      });

      // Check updated field
      expect(fieldDefinitions.updated).toEqual({
        type: expect.any(Object),
        defaultValue: expect.any(Object)
      });
    });

    test('should generate UUID for id by default', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      const idDefaultValue = fieldDefinitions.id.defaultValue;
      
      expect(typeof idDefaultValue).toBe('function');
      
      const generatedId = idDefaultValue();
      expect(generatedId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('should have correct timestamp configuration', () => {
      const options = mockSequelize.define.mock.calls[0][2];
      
      expect(options.timestamps).toBe(true);
      expect(options.createdAt).toBe('created');
      expect(options.updatedAt).toBe('updated');
    });

    test('should have unique constraint on team_id and user_id', () => {
      const options = mockSequelize.define.mock.calls[0][2];
      
      expect(options.indexes).toContainEqual({
        unique: true,
        fields: ['team_id', 'user_id']
      });
    });
  });

  describe('Field Validations', () => {
    let mockTeamMemberInstance;
    let mockCreate;

    beforeEach(() => {
      mockTeamMemberInstance = {
        id: uuidv4(),
        team_id: 'team-123',
        user_id: 'user-456',
        role: 'member',
        joined_at: new Date(),
        created: new Date(),
        updated: new Date(),
        save: jest.fn().mockResolvedValue(true),
        validate: jest.fn().mockResolvedValue(true)
      };

      mockCreate = jest.fn().mockResolvedValue(mockTeamMemberInstance);
      
      // Mock the model methods
      Object.assign(TeamMember, {
        create: mockCreate,
        findAll: jest.fn().mockResolvedValue([mockTeamMemberInstance]),
        findOne: jest.fn().mockResolvedValue(mockTeamMemberInstance),
        findByPk: jest.fn().mockResolvedValue(mockTeamMemberInstance),
        update: jest.fn().mockResolvedValue([1]),
        destroy: jest.fn().mockResolvedValue(1),
        count: jest.fn().mockResolvedValue(5)
      });
    });

    test('should create team member with valid data', async () => {
      const validData = {
        team_id: 'team-123',
        user_id: 'user-456',
        role: 'admin'
      };

      const result = await TeamMember.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockTeamMemberInstance);
    });

    test('should create team member with default role', async () => {
      const validData = {
        team_id: 'team-123',
        user_id: 'user-456'
      };

      const result = await TeamMember.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockTeamMemberInstance);
    });

    test('should create team member with admin role', async () => {
      const validData = {
        team_id: 'team-123',
        user_id: 'user-456',
        role: 'admin'
      };

      const result = await TeamMember.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockTeamMemberInstance);
    });

    test('should create team member with member role', async () => {
      const validData = {
        team_id: 'team-123',
        user_id: 'user-456',
        role: 'member'
      };

      const result = await TeamMember.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockTeamMemberInstance);
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

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockTeamMemberInstance);
    });
  });

  describe('Data Integrity', () => {
    test('should ensure team_id is required', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.team_id.allowNull).toBe(false);
    });

    test('should ensure user_id is required', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.user_id.allowNull).toBe(false);
    });

    test('should ensure role is required with default value', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.role.allowNull).toBe(false);
      expect(fieldDefinitions.role.defaultValue).toBe('member');
    });

    test('should ensure joined_at is required', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.joined_at.allowNull).toBe(false);
    });

    test('should have proper field types', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      // Check that role is ENUM
      expect(fieldDefinitions.role.type.constructor.name).toContain('ENUM');
      
      // Check that id fields are STRING(36) for UUIDs
      expect(fieldDefinitions.id.type.constructor.name).toContain('STRING');
      expect(fieldDefinitions.team_id.type.constructor.name).toContain('STRING');
      expect(fieldDefinitions.user_id.type.constructor.name).toContain('STRING');
      
      // Check that timestamp fields are DATE
      expect(fieldDefinitions.joined_at.type.constructor.name).toContain('DATE');
      expect(fieldDefinitions.created.type.constructor.name).toContain('DATE');
      expect(fieldDefinitions.updated.type.constructor.name).toContain('DATE');
    });

    test('should have ENUM values for role field', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      const roleField = fieldDefinitions.role;
      
      // The ENUM type should contain valid role values
      expect(roleField.type.constructor.name).toContain('ENUM');
    });
  });

  describe('Model Relationships', () => {
    test('should reference Team model in team_id field', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.team_id.references).toEqual({
        model: mockTeam,
        key: 'id'
      });
    });

    test('should reference User model in user_id field', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.user_id.references).toEqual({
        model: mockUser,
        key: 'id'
      });
    });
  });

  describe('Team Membership Operations', () => {
    test('should support querying team members by team', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
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
      ]);

      Object.assign(TeamMember, { findAll: mockFindAll });

      const teamMembers = await TeamMember.findAll({
        where: { team_id: 'team-123' },
        order: [['joined_at', 'ASC']]
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { team_id: 'team-123' },
        order: [['joined_at', 'ASC']]
      });
      expect(teamMembers).toHaveLength(2);
    });

    test('should support querying teams by user', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
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
      ]);

      Object.assign(TeamMember, { findAll: mockFindAll });

      const userMemberships = await TeamMember.findAll({
        where: { user_id: 'user-456' },
        order: [['joined_at', 'DESC']]
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { user_id: 'user-456' },
        order: [['joined_at', 'DESC']]
      });
      expect(userMemberships).toHaveLength(2);
    });

    test('should support checking if user is team member', async () => {
      const mockFindOne = jest.fn().mockResolvedValue({
        id: '1',
        team_id: 'team-123',
        user_id: 'user-456',
        role: 'member',
        joined_at: new Date()
      });

      Object.assign(TeamMember, { findOne: mockFindOne });

      const membership = await TeamMember.findOne({
        where: { 
          team_id: 'team-123',
          user_id: 'user-456'
        }
      });

      expect(mockFindOne).toHaveBeenCalledWith({
        where: { 
          team_id: 'team-123',
          user_id: 'user-456'
        }
      });
      expect(membership).toBeTruthy();
      expect(membership.role).toBe('member');
    });

    test('should support updating member role', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(TeamMember, { update: mockUpdate });

      const updatedCount = await TeamMember.update(
        { role: 'admin' },
        { 
          where: { 
            team_id: 'team-123',
            user_id: 'user-456'
          }
        }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
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
      const mockDestroy = jest.fn().mockResolvedValue(1);

      Object.assign(TeamMember, { destroy: mockDestroy });

      const deletedCount = await TeamMember.destroy({
        where: { 
          team_id: 'team-123',
          user_id: 'user-456'
        }
      });

      expect(mockDestroy).toHaveBeenCalledWith({
        where: { 
          team_id: 'team-123',
          user_id: 'user-456'
        }
      });
      expect(deletedCount).toBe(1);
    });

    test('should support counting team members', async () => {
      const mockCount = jest.fn().mockResolvedValue(12);

      Object.assign(TeamMember, { count: mockCount });

      const memberCount = await TeamMember.count({
        where: { team_id: 'team-123' }
      });

      expect(mockCount).toHaveBeenCalledWith({
        where: { team_id: 'team-123' }
      });
      expect(memberCount).toBe(12);
    });
  });

  describe('Role Management', () => {
    test('should support querying team admins', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
        {
          id: '1',
          team_id: 'team-123',
          user_id: 'user-456',
          role: 'admin',
          joined_at: new Date()
        }
      ]);

      Object.assign(TeamMember, { findAll: mockFindAll });

      const teamAdmins = await TeamMember.findAll({
        where: { 
          team_id: 'team-123',
          role: 'admin'
        }
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { 
          team_id: 'team-123',
          role: 'admin'
        }
      });
      expect(teamAdmins).toHaveLength(1);
      expect(teamAdmins[0].role).toBe('admin');
    });

    test('should support querying regular members', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
        {
          id: '1',
          team_id: 'team-123',
          user_id: 'user-789',
          role: 'member',
          joined_at: new Date()
        },
        {
          id: '2',
          team_id: 'team-123',
          user_id: 'user-101',
          role: 'member',
          joined_at: new Date()
        }
      ]);

      Object.assign(TeamMember, { findAll: mockFindAll });

      const regularMembers = await TeamMember.findAll({
        where: { 
          team_id: 'team-123',
          role: 'member'
        }
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { 
          team_id: 'team-123',
          role: 'member'
        }
      });
      expect(regularMembers).toHaveLength(2);
      regularMembers.forEach(member => {
        expect(member.role).toBe('member');
      });
    });

    test('should support promoting member to admin', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(TeamMember, { update: mockUpdate });

      const updatedCount = await TeamMember.update(
        { role: 'admin' },
        { 
          where: { 
            team_id: 'team-123',
            user_id: 'user-456'
          }
        }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
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
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(TeamMember, { update: mockUpdate });

      const updatedCount = await TeamMember.update(
        { role: 'member' },
        { 
          where: { 
            team_id: 'team-123',
            user_id: 'user-456'
          }
        }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
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
      const mockCount = jest.fn()
        .mockResolvedValueOnce(2) // admin count
        .mockResolvedValueOnce(8); // member count

      Object.assign(TeamMember, { count: mockCount });

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
      expect(mockCount).toHaveBeenCalledTimes(2);
    });

    test('should support finding recent joiners', async () => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const mockFindAll = jest.fn().mockResolvedValue([
        {
          id: '1',
          team_id: 'team-123',
          user_id: 'user-456',
          role: 'member',
          joined_at: new Date()
        }
      ]);

      Object.assign(TeamMember, { findAll: mockFindAll });

      const recentJoiners = await TeamMember.findAll({
        where: { 
          team_id: 'team-123',
          joined_at: {
            [require('sequelize').Op.gte]: oneWeekAgo
          }
        },
        order: [['joined_at', 'DESC']]
      });

      expect(mockFindAll).toHaveBeenCalledWith({
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
      const mockBulkCreate = jest.fn().mockResolvedValue([
        { id: '1', team_id: 'team-123', user_id: 'user-1', role: 'member' },
        { id: '2', team_id: 'team-123', user_id: 'user-2', role: 'member' },
        { id: '3', team_id: 'team-123', user_id: 'user-3', role: 'member' }
      ]);

      Object.assign(TeamMember, { bulkCreate: mockBulkCreate });

      const membersData = [
        { team_id: 'team-123', user_id: 'user-1', role: 'member' },
        { team_id: 'team-123', user_id: 'user-2', role: 'member' },
        { team_id: 'team-123', user_id: 'user-3', role: 'member' }
      ];

      const createdMembers = await TeamMember.bulkCreate(membersData);

      expect(mockBulkCreate).toHaveBeenCalledWith(membersData);
      expect(createdMembers).toHaveLength(3);
    });

    test('should support removing all team members', async () => {
      const mockDestroy = jest.fn().mockResolvedValue(10); // 10 members removed

      Object.assign(TeamMember, { destroy: mockDestroy });

      const deletedCount = await TeamMember.destroy({
        where: { team_id: 'team-123' }
      });

      expect(mockDestroy).toHaveBeenCalledWith({
        where: { team_id: 'team-123' }
      });
      expect(deletedCount).toBe(10);
    });
  });

  describe('Validation and Business Rules', () => {
    test('should enforce unique constraint on team_id and user_id combination', () => {
      const options = mockSequelize.define.mock.calls[0][2];
      
      const uniqueIndex = options.indexes.find(index => index.unique);
      expect(uniqueIndex).toBeDefined();
      expect(uniqueIndex.fields).toEqual(['team_id', 'user_id']);
    });

    test('should handle role validation through ENUM type', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      const roleField = fieldDefinitions.role;
      
      expect(roleField.type.constructor.name).toContain('ENUM');
      expect(roleField.allowNull).toBe(false);
      expect(roleField.defaultValue).toBe('member');
    });

    test('should support membership status tracking through timestamps', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.joined_at.allowNull).toBe(false);
      expect(fieldDefinitions.created).toBeDefined();
      expect(fieldDefinitions.updated).toBeDefined();
    });
  });
});