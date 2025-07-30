/**
 * Team controller unit tests
 *
 * Tests for team management functionality
 *
 * @author meetabl Team
 */

// Mock dependencies before imports
jest.mock('../../../src/config/logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../../src/services/team.service', () => ({
  createTeam: jest.fn(),
  getUserTeams: jest.fn(),
  getTeamById: jest.fn(),
  updateTeam: jest.fn(),
  deleteTeam: jest.fn(),
  addTeamMember: jest.fn(),
  removeTeamMember: jest.fn(),
  getTeamMembers: jest.fn()
}));

jest.mock('../../../src/utils/error-response', () => ({
  asyncHandler: jest.fn((fn) => fn),
  successResponse: jest.fn((res, data, message, statusCode = 200) => {
    return res.status(statusCode).json({
      message,
      data
    });
  }),
  notFoundError: jest.fn((entity) => {
    const error = new Error(`${entity} not found`);
    error.statusCode = 404;
    return error;
  }),
  forbiddenError: jest.fn((message) => {
    const error = new Error(message);
    error.statusCode = 403;
    return error;
  }),
  validationError: jest.fn((errors) => {
    const error = new Error('Validation failed');
    error.statusCode = 400;
    error.errors = errors;
    return error;
  }),
  conflictError: jest.fn((message) => {
    const error = new Error(message);
    error.statusCode = 409;
    return error;
  })
}));

// Import controller after mocks are set up
const {
  createTeam,
  getUserTeams,
  getTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
  createSharedCalendar
} = require('../../../src/controllers/team.controller');

const teamService = require('../../../src/services/team.service');
const logger = require('../../../src/config/logger');

// Test utilities
const createMockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: { id: 'test-user-id' },
  ...overrides
});

const createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

describe('Team Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTeam', () => {
    test('should create team successfully', async () => {
      // Mock team service
      const mockTeam = {
        id: 'team-id',
        name: 'Test Team',
        description: 'Test Description',
        owner_id: 'test-user-id'
      };
      teamService.createTeam.mockResolvedValueOnce(mockTeam);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: {
          name: 'Test Team',
          description: 'Test Description'
        }
      });
      const res = createMockResponse();

      // Execute controller
      await createTeam(req, res);

      // Verify service was called
      expect(teamService.createTeam).toHaveBeenCalledWith('test-user-id', {
        name: 'Test Team',
        description: 'Test Description'
      });

      // Verify logger was called
      expect(logger.info).toHaveBeenCalledWith('Team created successfully: team-id');

      // Verify response
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Team created successfully',
        data: { team: mockTeam }
      });
    });

    test('should handle service errors', async () => {
      // Mock service error
      teamService.createTeam.mockRejectedValueOnce(new Error('Service error'));

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: { name: 'Test Team' }
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(createTeam(req, res)).rejects.toThrow('Service error');
    });
  });

  describe('getUserTeams', () => {
    test('should get user teams successfully', async () => {
      // Mock teams data
      const mockResult = {
        teams: [
          { id: 'team-1', name: 'Team 1' },
          { id: 'team-2', name: 'Team 2' }
        ],
        total: 2
      };
      teamService.getUserTeams.mockResolvedValueOnce(mockResult);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        query: { limit: '10', offset: '0' }
      });
      const res = createMockResponse();

      // Execute controller
      await getUserTeams(req, res);

      // Verify service was called with options
      expect(teamService.getUserTeams).toHaveBeenCalledWith('test-user-id', {
        limit: '10',
        offset: '0',
        order: undefined,
        dir: undefined
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Teams retrieved successfully',
        data: mockResult
      });
    });

    test('should handle service errors', async () => {
      // Mock service error
      teamService.getUserTeams.mockRejectedValueOnce(new Error('Service error'));

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' }
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(getUserTeams(req, res)).rejects.toThrow('Service error');
    });
  });

  describe('getTeam', () => {
    test('should get team successfully', async () => {
      // Mock team data
      const mockTeam = {
        id: 'team-id',
        name: 'Test Team',
        description: 'Test Description'
      };
      teamService.getTeamById.mockResolvedValueOnce(mockTeam);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'team-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await getTeam(req, res);

      // Verify service was called
      expect(teamService.getTeamById).toHaveBeenCalledWith('team-id', 'test-user-id');

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Team retrieved successfully',
        data: { team: mockTeam }
      });
    });

    test('should handle team not found', async () => {
      // Mock team not found
      const notFoundError = new Error('Team not found');
      notFoundError.statusCode = 404;
      teamService.getTeamById.mockRejectedValueOnce(notFoundError);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'non-existent-id' }
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(getTeam(req, res)).rejects.toThrow('Team not found');
    });

    test('should handle forbidden access', async () => {
      // Mock forbidden error
      const forbiddenError = new Error('Access denied');
      forbiddenError.statusCode = 403;
      teamService.getTeamById.mockRejectedValueOnce(forbiddenError);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'team-id' }
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(getTeam(req, res)).rejects.toThrow('Access denied');
    });
  });

  describe('updateTeam', () => {
    test('should update team successfully', async () => {
      // Mock updated team
      const mockTeam = {
        id: 'team-id',
        name: 'Updated Team',
        description: 'Updated Description'
      };
      teamService.updateTeam.mockResolvedValueOnce(mockTeam);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'team-id' },
        body: {
          name: 'Updated Team',
          description: 'Updated Description'
        }
      });
      const res = createMockResponse();

      // Execute controller
      await updateTeam(req, res);

      // Verify service was called
      expect(teamService.updateTeam).toHaveBeenCalledWith('team-id', 'test-user-id', {
        name: 'Updated Team',
        description: 'Updated Description'
      });

      // Verify logger was called
      expect(logger.info).toHaveBeenCalledWith('Team updated successfully: team-id');

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Team updated successfully',
        data: { team: mockTeam }
      });
    });

    test('should handle validation errors', async () => {
      // Mock validation error
      const validationError = new Error('Validation failed');
      validationError.name = 'SequelizeValidationError';
      validationError.errors = [
        { path: 'name', message: 'Name cannot be empty' }
      ];
      teamService.updateTeam.mockRejectedValueOnce(validationError);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'team-id' },
        body: { name: '' }
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(updateTeam(req, res)).rejects.toThrow('Validation failed');
    });
  });

  describe('deleteTeam', () => {
    test('should delete team successfully', async () => {
      // Mock successful deletion
      teamService.deleteTeam.mockResolvedValueOnce();

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'team-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await deleteTeam(req, res);

      // Verify service was called
      expect(teamService.deleteTeam).toHaveBeenCalledWith('team-id', 'test-user-id');

      // Verify logger was called
      expect(logger.info).toHaveBeenCalledWith('Team deleted successfully: team-id');

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Team deleted successfully',
        data: null
      });
    });

    test('should handle unauthorized deletion', async () => {
      // Mock unauthorized error
      const unauthorizedError = new Error('Access denied');
      unauthorizedError.statusCode = 403;
      teamService.deleteTeam.mockRejectedValueOnce(unauthorizedError);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'team-id' }
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(deleteTeam(req, res)).rejects.toThrow('Access denied');
    });
  });

  describe('getTeamMembers', () => {
    test('should get team members successfully', async () => {
      // Mock members data
      const mockResult = {
        members: [
          { id: 'member-1', user_id: 'user-1', role: 'admin' },
          { id: 'member-2', user_id: 'user-2', role: 'member' }
        ],
        total: 2
      };
      teamService.getTeamMembers.mockResolvedValueOnce(mockResult);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'team-id' },
        query: { limit: '10', offset: '0' }
      });
      const res = createMockResponse();

      // Execute controller
      await getTeamMembers(req, res);

      // Verify service was called
      expect(teamService.getTeamMembers).toHaveBeenCalledWith('team-id', 'test-user-id', {
        limit: '10',
        offset: '0'
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Team members retrieved successfully',
        data: mockResult
      });
    });

    test('should handle forbidden access', async () => {
      // Mock forbidden error
      const forbiddenError = new Error('Access denied');
      forbiddenError.statusCode = 403;
      teamService.getTeamMembers.mockRejectedValueOnce(forbiddenError);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'team-id' }
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(getTeamMembers(req, res)).rejects.toThrow('Access denied');
    });
  });

  describe('addTeamMember', () => {
    test('should add member successfully', async () => {
      // Mock member addition
      const mockMember = {
        id: 'member-id',
        user_id: 'new-user-id',
        team_id: 'team-id',
        role: 'member'
      };
      teamService.addTeamMember.mockResolvedValueOnce(mockMember);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'team-id' },
        body: {
          user_id: 'new-user-id',
          role: 'member'
        }
      });
      const res = createMockResponse();

      // Execute controller
      await addTeamMember(req, res);

      // Verify service was called
      expect(teamService.addTeamMember).toHaveBeenCalledWith('team-id', 'test-user-id', {
        user_id: 'new-user-id',
        role: 'member'
      });

      // Verify logger was called
      expect(logger.info).toHaveBeenCalledWith('Team member added successfully: new-user-id to team team-id');

      // Verify response
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Team member added successfully',
        data: { member: mockMember }
      });
    });

    test('should handle duplicate member error', async () => {
      // Mock duplicate error
      const duplicateError = new Error('User already a member');
      duplicateError.statusCode = 409;
      teamService.addTeamMember.mockRejectedValueOnce(duplicateError);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'team-id' },
        body: {
          user_id: 'existing-user-id',
          role: 'member'
        }
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(addTeamMember(req, res)).rejects.toThrow('User already a member');
    });
  });

  describe('removeTeamMember', () => {
    test('should remove member successfully', async () => {
      // Mock successful removal
      teamService.removeTeamMember.mockResolvedValueOnce();

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { 
          id: 'team-id',
          userId: 'member-user-id'
        }
      });
      const res = createMockResponse();

      // Execute controller
      await removeTeamMember(req, res);

      // Verify service was called
      expect(teamService.removeTeamMember).toHaveBeenCalledWith('team-id', 'test-user-id', 'member-user-id');

      // Verify logger was called
      expect(logger.info).toHaveBeenCalledWith('Team member removed successfully: member-user-id from team team-id');

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Team member removed successfully',
        data: null
      });
    });

    test('should handle member not found', async () => {
      // Mock member not found
      const notFoundError = new Error('Member not found');
      notFoundError.statusCode = 404;
      teamService.removeTeamMember.mockRejectedValueOnce(notFoundError);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { 
          id: 'team-id',
          userId: 'non-existent-id'
        }
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(removeTeamMember(req, res)).rejects.toThrow('Member not found');
    });
  });

  describe('createSharedCalendar', () => {
    test('should throw not implemented error', async () => {
      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'team-id' },
        body: {
          name: 'Team Calendar',
          description: 'Team calendar description'
        }
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(createSharedCalendar(req, res)).rejects.toThrow('Shared calendar creation not yet implemented');
    });
  });
});