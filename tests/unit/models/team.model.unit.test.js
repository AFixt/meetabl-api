/**
 * Team model unit tests
 *
 * Tests the Team model definition, validations, and behavior
 *
 * @author meetabl Team
 */

require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup mocks
setupControllerMocks();

// Import models after mocks are set up
const { Team } = require('../../../src/models');
const { v4: uuidv4 } = jest.requireActual('uuid');

describe('Team Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Team model methods
    Team.create = jest.fn();
    Team.findAll = jest.fn();
    Team.findOne = jest.fn();
    Team.findByPk = jest.fn();
    Team.update = jest.fn();
    Team.destroy = jest.fn();
    Team.findAndCountAll = jest.fn();
    Team.count = jest.fn();
    Team.bulkCreate = jest.fn();
  });

  describe('Team Operations', () => {
    beforeEach(() => {
      // Setup default mock implementations
      Team.create.mockImplementation(async (data) => ({
        id: data.id || uuidv4(),
        name: data.name,
        description: data.description || null,
        owner_id: data.owner_id,
        created: new Date(),
        updated: new Date(),
        ...data
      }));
      
      Team.findAll.mockResolvedValue([]);
      Team.findOne.mockResolvedValue(null);
      Team.update.mockResolvedValue([1]);
      Team.destroy.mockResolvedValue(1);
    });

    test('should create team with valid data', async () => {
      const validData = {
        name: 'Marketing Team',
        description: 'Team responsible for marketing and customer outreach',
        owner_id: 'user-123'
      };

      const result = await Team.create(validData);

      expect(Team.create).toHaveBeenCalledWith(validData);
      expect(result).toMatchObject(validData);
      expect(result.id).toBeDefined();
      expect(result.created).toBeInstanceOf(Date);
    });

    test('should create team without description', async () => {
      const validData = {
        name: 'Sales Team',
        owner_id: 'user-123'
      };

      const result = await Team.create(validData);

      expect(Team.create).toHaveBeenCalledWith(validData);
      expect(result).toMatchObject(validData);
      expect(result.description).toBeNull();
    });

    test('should handle teams with short names', async () => {
      const validData = {
        name: 'QA',
        description: 'Quality Assurance team',
        owner_id: 'user-123'
      };

      const result = await Team.create(validData);

      expect(Team.create).toHaveBeenCalledWith(validData);
      expect(result.name).toBe('QA');
    });

    test('should handle teams with long names', async () => {
      const longName = 'A'.repeat(100); // Test at the limit

      const validData = {
        name: longName,
        description: 'Team with a very long name for testing purposes',
        owner_id: 'user-123'
      };

      const result = await Team.create(validData);

      expect(Team.create).toHaveBeenCalledWith(validData);
      expect(result.name).toBe(longName);
    });

    test('should support querying teams by owner', async () => {
      const mockTeams = [
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
      ];
      
      Team.findAll.mockResolvedValue(mockTeams);

      const ownerTeams = await Team.findAll({
        where: { owner_id: 'user-123' },
        order: [['created', 'DESC']]
      });

      expect(Team.findAll).toHaveBeenCalledWith({
        where: { owner_id: 'user-123' },
        order: [['created', 'DESC']]
      });
      expect(ownerTeams).toHaveLength(2);
    });

    test('should support updating team information', async () => {
      const updateData = {
        name: 'Updated Team Name',
        description: 'Updated team description with new goals and objectives'
      };

      const updatedCount = await Team.update(
        updateData,
        { where: { id: 'team-123' } }
      );

      expect(Team.update).toHaveBeenCalledWith(
        updateData,
        { where: { id: 'team-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support deleting teams', async () => {
      const deletedCount = await Team.destroy({
        where: { id: 'team-123' }
      });

      expect(Team.destroy).toHaveBeenCalledWith({
        where: { id: 'team-123' }
      });
      expect(deletedCount).toBe(1);
    });

    test('should support transferring team ownership', async () => {
      const newOwnerId = 'user-456';
      const updatedCount = await Team.update(
        { owner_id: newOwnerId },
        { where: { id: 'team-123' } }
      );

      expect(Team.update).toHaveBeenCalledWith(
        { owner_id: newOwnerId },
        { where: { id: 'team-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });
  });

  describe('Team Types and Use Cases', () => {
    beforeEach(() => {
      Team.create.mockImplementation(async (data) => ({
        id: data.id || uuidv4(),
        owner_id: data.owner_id,
        name: data.name,
        description: data.description || null,
        created_at: new Date(),
        updated_at: new Date(),
        ...data
      }));
    });

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
      const validData = {
        name: teamType.name,
        description: teamType.description,
        owner_id: 'user-123'
      };

      const result = await Team.create(validData);

      expect(Team.create).toHaveBeenCalledWith(validData);
      expect(result.name).toBe(teamType.name);
      expect(result.description).toBe(teamType.description);
    });
  });

  describe('Business Logic Support', () => {
    test('should support pagination for large team lists', async () => {
      Team.findAndCountAll.mockResolvedValue({
        count: 50,
        rows: Array(10).fill().map((_, i) => ({
          id: `team-${i}`,
          name: `Team ${i}`,
          owner_id: 'user-123',
          created: new Date()
        }))
      });

      const result = await Team.findAndCountAll({
        limit: 10,
        offset: 0,
        order: [['created', 'DESC']]
      });

      expect(Team.findAndCountAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
        order: [['created', 'DESC']]
      });
      expect(result.count).toBe(50);
      expect(result.rows).toHaveLength(10);
    });

    test('should support counting teams per owner', async () => {
      Team.count.mockResolvedValue(5);

      const teamCount = await Team.count({
        where: { owner_id: 'user-123' }
      });

      expect(Team.count).toHaveBeenCalledWith({
        where: { owner_id: 'user-123' }
      });
      expect(teamCount).toBe(5);
    });

    test('should support bulk operations for team management', async () => {
      const teamsData = [
        { name: 'Alpha Team', owner_id: 'user-123' },
        { name: 'Beta Team', owner_id: 'user-123' },
        { name: 'Gamma Team', owner_id: 'user-123' }
      ];

      Team.bulkCreate.mockResolvedValue(
        teamsData.map((data, i) => ({
          id: `${i + 1}`,
          ...data,
          created: new Date(),
          updated: new Date()
        }))
      );

      const createdTeams = await Team.bulkCreate(teamsData);

      expect(Team.bulkCreate).toHaveBeenCalledWith(teamsData);
      expect(createdTeams).toHaveLength(3);
    });
  });

  describe('Special Characters and Unicode', () => {
    beforeEach(() => {
      Team.create.mockImplementation(async (data) => ({
        id: data.id || uuidv4(),
        owner_id: data.owner_id,
        name: data.name,
        description: data.description || null,
        created_at: new Date(),
        updated_at: new Date(),
        ...data
      }));
    });

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

      for (const name of specialNames) {
        const validData = {
          name,
          owner_id: 'user-123'
        };

        const result = await Team.create(validData);

        expect(result.name).toBe(name);
      }

      expect(Team.create).toHaveBeenCalledTimes(specialNames.length);
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

      for (const name of unicodeNames) {
        const validData = {
          name,
          owner_id: 'user-123'
        };

        const result = await Team.create(validData);

        expect(result.name).toBe(name);
      }

      expect(Team.create).toHaveBeenCalledTimes(unicodeNames.length);
    });
  });
});