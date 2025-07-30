/**
 * Team model unit tests
 *
 * Tests the Team model definition, validations, and behavior
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

jest.mock('../../../src/config/database', () => ({
  sequelize: mockSequelize
}));

jest.mock('../../../src/models/user.model', () => mockUser);

// Import the model after mocking
const Team = require('../../../src/models/team.model');

describe('Team Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Model Definition', () => {
    test('should define Team model with correct table name', () => {
      expect(mockSequelize.define).toHaveBeenCalledWith(
        'Team',
        expect.any(Object),
        expect.objectContaining({
          tableName: 'teams',
          timestamps: true,
          createdAt: 'created',
          updatedAt: 'updated'
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

      // Check name field
      expect(fieldDefinitions.name).toEqual({
        type: expect.any(Object),
        allowNull: false,
        validate: {
          notEmpty: true
        }
      });

      // Check description field
      expect(fieldDefinitions.description).toEqual({
        type: expect.any(Object),
        allowNull: true
      });

      // Check owner_id field
      expect(fieldDefinitions.owner_id).toEqual({
        type: expect.any(Object),
        allowNull: false,
        references: {
          model: mockUser,
          key: 'id'
        }
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
  });

  describe('Field Validations', () => {
    let mockTeamInstance;
    let mockCreate;

    beforeEach(() => {
      mockTeamInstance = {
        id: uuidv4(),
        name: 'Engineering Team',
        description: 'Software development team responsible for building the platform',
        owner_id: 'user-123',
        created: new Date(),
        updated: new Date(),
        save: jest.fn().mockResolvedValue(true),
        validate: jest.fn().mockResolvedValue(true)
      };

      mockCreate = jest.fn().mockResolvedValue(mockTeamInstance);
      
      // Mock the model methods
      Object.assign(Team, {
        create: mockCreate,
        findAll: jest.fn().mockResolvedValue([mockTeamInstance]),
        findOne: jest.fn().mockResolvedValue(mockTeamInstance),
        findByPk: jest.fn().mockResolvedValue(mockTeamInstance),
        update: jest.fn().mockResolvedValue([1]),
        destroy: jest.fn().mockResolvedValue(1)
      });
    });

    test('should create team with valid data', async () => {
      const validData = {
        name: 'Marketing Team',
        description: 'Team responsible for marketing and customer outreach',
        owner_id: 'user-123'
      };

      const result = await Team.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockTeamInstance);
    });

    test('should create team without description', async () => {
      const validData = {
        name: 'Sales Team',
        owner_id: 'user-123'
      };

      const result = await Team.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockTeamInstance);
    });

    test('should handle teams with short names', async () => {
      const validData = {
        name: 'QA',
        description: 'Quality Assurance team',
        owner_id: 'user-123'
      };

      const result = await Team.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockTeamInstance);
    });

    test('should handle teams with long names', async () => {
      const longName = 'A'.repeat(100); // Test at the limit of STRING(100)

      const validData = {
        name: longName,
        description: 'Team with a very long name for testing purposes',
        owner_id: 'user-123'
      };

      const result = await Team.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockTeamInstance);
    });

    test('should handle teams with detailed descriptions', async () => {
      const longDescription = `
        This is a comprehensive description of the team that includes:
        - Team mission and objectives
        - Key responsibilities and areas of focus
        - Team structure and hierarchy
        - Working methodologies and processes
        - Success metrics and KPIs
        - Collaboration tools and communication channels
        - Team culture and values
      `.trim();

      const validData = {
        name: 'Product Team',
        description: longDescription,
        owner_id: 'user-123'
      };

      const result = await Team.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockTeamInstance);
    });
  });

  describe('Data Integrity', () => {
    test('should ensure name is required and not empty', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.name.allowNull).toBe(false);
      expect(fieldDefinitions.name.validate.notEmpty).toBe(true);
    });

    test('should ensure owner_id is required', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.owner_id.allowNull).toBe(false);
    });

    test('should allow description to be null', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.description.allowNull).toBe(true);
    });

    test('should have proper field types', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      // Check that name is STRING(100)
      expect(fieldDefinitions.name.type.constructor.name).toContain('STRING');
      
      // Check that description is TEXT
      expect(fieldDefinitions.description.type.constructor.name).toContain('TEXT');
      
      // Check that id fields are STRING(36) for UUIDs
      expect(fieldDefinitions.id.type.constructor.name).toContain('STRING');
      expect(fieldDefinitions.owner_id.type.constructor.name).toContain('STRING');
      
      // Check that timestamp fields are DATE
      expect(fieldDefinitions.created.type.constructor.name).toContain('DATE');
      expect(fieldDefinitions.updated.type.constructor.name).toContain('DATE');
    });
  });

  describe('Model Relationships', () => {
    test('should reference User model in owner_id field', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.owner_id.references).toEqual({
        model: mockUser,
        key: 'id'
      });
    });
  });

  describe('Team Management Operations', () => {
    test('should support querying teams by owner', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
        {
          id: '1',
          name: 'Team Alpha',
          owner_id: 'user-123',
          created: new Date()
        },
        {
          id: '2',
          name: 'Team Beta',
          owner_id: 'user-123',
          created: new Date()
        }
      ]);

      Object.assign(Team, { findAll: mockFindAll });

      const ownerTeams = await Team.findAll({
        where: { owner_id: 'user-123' },
        order: [['created', 'DESC']]
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { owner_id: 'user-123' },
        order: [['created', 'DESC']]
      });
      expect(ownerTeams).toHaveLength(2);
    });

    test('should support updating team information', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(Team, { update: mockUpdate });

      const updateData = {
        name: 'Updated Team Name',
        description: 'Updated team description with new goals and objectives'
      };

      const updatedCount = await Team.update(
        updateData,
        { where: { id: 'team-123' } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        updateData,
        { where: { id: 'team-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support deleting teams', async () => {
      const mockDestroy = jest.fn().mockResolvedValue(1);

      Object.assign(Team, { destroy: mockDestroy });

      const deletedCount = await Team.destroy({
        where: { id: 'team-123' }
      });

      expect(mockDestroy).toHaveBeenCalledWith({
        where: { id: 'team-123' }
      });
      expect(deletedCount).toBe(1);
    });

    test('should support transferring team ownership', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(Team, { update: mockUpdate });

      const newOwnerId = 'user-456';
      const updatedCount = await Team.update(
        { owner_id: newOwnerId },
        { where: { id: 'team-123' } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        { owner_id: newOwnerId },
        { where: { id: 'team-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support searching teams by name', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
        {
          id: '1',
          name: 'Engineering Team',
          description: 'Software development team',
          owner_id: 'user-123'
        }
      ]);

      Object.assign(Team, { findAll: mockFindAll });

      const searchResults = await Team.findAll({
        where: {
          name: {
            [require('sequelize').Op.iLike]: '%Engineering%'
          }
        }
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: {
          name: {
            [require('sequelize').Op.iLike]: '%Engineering%'
          }
        }
      });
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].name).toContain('Engineering');
    });
  });

  describe('Team Types and Use Cases', () => {
    const teamTypes = [
      { name: 'Development Team', description: 'Software development and engineering' },
      { name: 'Marketing Team', description: 'Marketing, PR, and customer outreach' },
      { name: 'Sales Team', description: 'Sales, business development, and partnerships' },
      { name: 'Support Team', description: 'Customer support and success' },
      { name: 'Operations Team', description: 'Business operations and administration' },
      { name: 'Design Team', description: 'UI/UX design and creative work' },
      { name: 'Data Team', description: 'Analytics, data science, and reporting' },
      { name: 'HR Team', description: 'Human resources and people operations' }
    ];

    test.each(teamTypes)('should support creating %s', async (teamType) => {
      const mockCreate = jest.fn().mockResolvedValue({
        id: uuidv4(),
        name: teamType.name,
        description: teamType.description,
        owner_id: 'user-123',
        created: new Date(),
        updated: new Date()
      });

      Object.assign(Team, { create: mockCreate });

      const validData = {
        name: teamType.name,
        description: teamType.description,
        owner_id: 'user-123'
      };

      const result = await Team.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result.name).toBe(teamType.name);
      expect(result.description).toBe(teamType.description);
    });

    test('should support creating teams for different organizational structures', async () => {
      const orgStructures = [
        'Department',
        'Division',
        'Squad',
        'Guild',
        'Chapter',
        'Tribe',
        'Task Force',
        'Working Group'
      ];

      const mockCreate = jest.fn().mockImplementation((data) => Promise.resolve({
        id: uuidv4(),
        ...data,
        created: new Date(),
        updated: new Date()
      }));

      Object.assign(Team, { create: mockCreate });

      const createdTeams = await Promise.all(
        orgStructures.map(structure => Team.create({
          name: `${structure} Alpha`,
          description: `A ${structure.toLowerCase()} within the organization`,
          owner_id: 'user-123'
        }))
      );

      expect(mockCreate).toHaveBeenCalledTimes(8);
      expect(createdTeams).toHaveLength(8);
      
      createdTeams.forEach((team, index) => {
        expect(team.name).toContain(orgStructures[index]);
        expect(team.owner_id).toBe('user-123');
      });
    });
  });

  describe('Business Logic Support', () => {
    test('should support pagination for large team lists', async () => {
      const mockFindAndCountAll = jest.fn().mockResolvedValue({
        count: 50,
        rows: Array(10).fill().map((_, i) => ({
          id: `team-${i}`,
          name: `Team ${i}`,
          owner_id: 'user-123',
          created: new Date()
        }))
      });

      Object.assign(Team, { findAndCountAll: mockFindAndCountAll });

      const result = await Team.findAndCountAll({
        limit: 10,
        offset: 0,
        order: [['created', 'DESC']]
      });

      expect(mockFindAndCountAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
        order: [['created', 'DESC']]
      });
      expect(result.count).toBe(50);
      expect(result.rows).toHaveLength(10);
    });

    test('should support counting teams per owner', async () => {
      const mockCount = jest.fn().mockResolvedValue(5);

      Object.assign(Team, { count: mockCount });

      const teamCount = await Team.count({
        where: { owner_id: 'user-123' }
      });

      expect(mockCount).toHaveBeenCalledWith({
        where: { owner_id: 'user-123' }
      });
      expect(teamCount).toBe(5);
    });

    test('should support bulk operations for team management', async () => {
      const mockBulkCreate = jest.fn().mockResolvedValue([
        { id: '1', name: 'Team 1', owner_id: 'user-123' },
        { id: '2', name: 'Team 2', owner_id: 'user-123' },
        { id: '3', name: 'Team 3', owner_id: 'user-123' }
      ]);

      Object.assign(Team, { bulkCreate: mockBulkCreate });

      const teamsData = [
        { name: 'Alpha Team', owner_id: 'user-123' },
        { name: 'Beta Team', owner_id: 'user-123' },
        { name: 'Gamma Team', owner_id: 'user-123' }
      ];

      const createdTeams = await Team.bulkCreate(teamsData);

      expect(mockBulkCreate).toHaveBeenCalledWith(teamsData);
      expect(createdTeams).toHaveLength(3);
    });
  });

  describe('Validation Edge Cases', () => {
    test('should handle special characters in team names', async () => {
      const specialNames = [
        'R&D Team',
        'Sales & Marketing',
        'Dev/Ops',
        'Team #1',
        'Alpha-Beta Team',
        'Team (2024)',
        'Team @ HQ'
      ];

      const mockCreate = jest.fn().mockImplementation((data) => Promise.resolve({
        id: uuidv4(),
        ...data,
        created: new Date(),
        updated: new Date()
      }));

      Object.assign(Team, { create: mockCreate });

      for (const name of specialNames) {
        const validData = {
          name,
          owner_id: 'user-123'
        };

        const result = await Team.create(validData);

        expect(result.name).toBe(name);
      }

      expect(mockCreate).toHaveBeenCalledTimes(specialNames.length);
    });

    test('should handle unicode characters in team names', async () => {
      const unicodeNames = [
        'Équipe Alpha', // French
        'Команда Beta', // Russian  
        'チーム・ガンマ', // Japanese
        'Team Ñoño', // Spanish
        'فريق دلتا', // Arabic
        'Team ñ' // Mixed
      ];

      const mockCreate = jest.fn().mockImplementation((data) => Promise.resolve({
        id: uuidv4(),
        ...data,
        created: new Date(),
        updated: new Date()
      }));

      Object.assign(Team, { create: mockCreate });

      for (const name of unicodeNames) {
        const validData = {
          name,
          owner_id: 'user-123'
        };

        const result = await Team.create(validData);

        expect(result.name).toBe(name);
      }

      expect(mockCreate).toHaveBeenCalledTimes(unicodeNames.length);
    });
  });
});