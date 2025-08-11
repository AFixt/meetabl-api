/**
 * Team controller
 *
 * Handles team/organization management requests
 *
 * @author meetabl Team
 */

const logger = require('../config/logger');
const teamService = require('../services/team.service');
const {
  asyncHandler,
  successResponse,
  notFoundError,
  forbiddenError,
  validationError,
  conflictError
} = require('../utils/error-response');

/**
 * Create a new team
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createTeam = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const teamData = req.body;

  const team = await teamService.createTeam(userId, teamData);

  logger.info(`Team created successfully: ${team.id}`);
  return successResponse(res, { team }, 'Team created successfully', 201);
});

/**
 * Get user's teams
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserTeams = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const options = {
    limit: req.query.limit,
    offset: req.query.offset,
    order: req.query.order,
    dir: req.query.dir
  };

  const result = await teamService.getUserTeams(userId, options);

  return successResponse(res, result, 'Teams retrieved successfully');
});

/**
 * Get team by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTeam = asyncHandler(async (req, res) => {
  const teamId = req.params.id;
  const userId = req.user.id;

  try {
    const team = await teamService.getTeamById(teamId, userId);
    return successResponse(res, { team }, 'Team retrieved successfully');
  } catch (error) {
    if (error.statusCode === 404) {
      throw notFoundError('Team');
    }
    if (error.statusCode === 403) {
      throw forbiddenError('Access denied');
    }
    throw error;
  }
});

/**
 * Update team
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateTeam = asyncHandler(async (req, res) => {
  const teamId = req.params.id;
  const userId = req.user.id;
  const updateData = req.body;

  try {
    const team = await teamService.updateTeam(teamId, userId, updateData);
    
    logger.info(`Team updated successfully: ${teamId}`);
    return successResponse(res, { team }, 'Team updated successfully');
  } catch (error) {
    if (error.statusCode === 404) {
      throw notFoundError('Team');
    }
    if (error.statusCode === 403) {
      throw forbiddenError('Access denied');
    }
    if (error.name === 'SequelizeValidationError') {
      throw validationError(error.errors.map((e) => ({
        field: e.path,
        message: e.message
      })));
    }
    throw error;
  }
});

/**
 * Delete team
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteTeam = asyncHandler(async (req, res) => {
  const teamId = req.params.id;
  const userId = req.user.id;

  try {
    await teamService.deleteTeam(teamId, userId);
    
    logger.info(`Team deleted successfully: ${teamId}`);
    return successResponse(res, null, 'Team deleted successfully');
  } catch (error) {
    if (error.statusCode === 404) {
      throw notFoundError('Team');
    }
    if (error.statusCode === 403) {
      throw forbiddenError('Access denied');
    }
    throw error;
  }
});

/**
 * Get team members
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTeamMembers = asyncHandler(async (req, res) => {
  const teamId = req.params.id;
  const userId = req.user.id;
  const options = {
    limit: req.query.limit,
    offset: req.query.offset
  };

  try {
    const result = await teamService.getTeamMembers(teamId, userId, options);
    return successResponse(res, result, 'Team members retrieved successfully');
  } catch (error) {
    if (error.statusCode === 403) {
      throw forbiddenError('Access denied');
    }
    throw error;
  }
});

/**
 * Add team member
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const addTeamMember = asyncHandler(async (req, res) => {
  const teamId = req.params.id;
  const userId = req.user.id;
  const memberData = req.body;

  try {
    const member = await teamService.addTeamMember(teamId, userId, memberData);
    
    logger.info(`Team member added successfully: ${memberData.user_id} to team ${teamId}`);
    return successResponse(res, { member }, 'Team member added successfully', 201);
  } catch (error) {
    if (error.statusCode === 404) {
      throw notFoundError(error.message);
    }
    if (error.statusCode === 403) {
      throw forbiddenError('Access denied');
    }
    if (error.statusCode === 409) {
      throw conflictError(error.message);
    }
    if (error.name === 'SequelizeValidationError') {
      throw validationError(error.errors.map((e) => ({
        field: e.path,
        message: e.message
      })));
    }
    throw error;
  }
});

/**
 * Remove team member
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const removeTeamMember = asyncHandler(async (req, res) => {
  const teamId = req.params.id;
  const userId = req.user.id;
  const memberUserId = req.params.userId;

  try {
    await teamService.removeTeamMember(teamId, userId, memberUserId);
    
    logger.info(`Team member removed successfully: ${memberUserId} from team ${teamId}`);
    return successResponse(res, null, 'Team member removed successfully');
  } catch (error) {
    if (error.statusCode === 404) {
      throw notFoundError(error.message);
    }
    if (error.statusCode === 403) {
      throw forbiddenError('Access denied');
    }
    if (error.statusCode === 400) {
      throw validationError([{ field: 'member', message: error.message }]);
    }
    throw error;
  }
});

/**
 * Create shared calendar for team
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createSharedCalendar = asyncHandler(async (req, res) => {
  // This is a placeholder for future implementation
  // When calendar integration is enhanced, this would create a shared calendar
  // for the team using the calendar service
  
  const error = new Error('Shared calendar creation not yet implemented');
  error.statusCode = 501;
  throw error;
});

module.exports = {
  createTeam,
  getUserTeams,
  getTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
  createSharedCalendar
};
