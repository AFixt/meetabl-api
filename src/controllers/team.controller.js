/**
 * Team controller
 *
 * Handles team/organization management requests
 *
 * @author meetabl Team
 */

const logger = require('../config/logger');
const teamService = require('../services/team.service');

/**
 * Create a new team
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    const teamData = req.body;

    const team = await teamService.createTeam(userId, teamData);

    logger.info(`Team created successfully: ${team.id}`);
    return res.status(201).json({
      message: 'Team created successfully',
      team
    });
  } catch (error) {
    logger.error('Error creating team:', error);

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: {
          code: 'validation_error',
          message: 'Validation failed',
          details: error.errors.map((e) => ({
            field: e.path,
            message: e.message
          }))
        }
      });
    }

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to create team'
      }
    });
  }
};

/**
 * Get user's teams
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserTeams = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      limit: req.query.limit,
      offset: req.query.offset,
      order: req.query.order,
      dir: req.query.dir
    };

    const result = await teamService.getUserTeams(userId, options);

    return res.json({
      message: 'Teams retrieved successfully',
      ...result
    });
  } catch (error) {
    logger.error('Error getting user teams:', error);
    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to retrieve teams'
      }
    });
  }
};

/**
 * Get team by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTeam = async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.user.id;

    const team = await teamService.getTeamById(teamId, userId);

    return res.json({
      message: 'Team retrieved successfully',
      team
    });
  } catch (error) {
    logger.error('Error getting team:', error);

    if (error.statusCode === 404) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Team not found'
        }
      });
    }

    if (error.statusCode === 403) {
      return res.status(403).json({
        error: {
          code: 'access_denied',
          message: 'Access denied'
        }
      });
    }

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to retrieve team'
      }
    });
  }
};

/**
 * Update team
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateTeam = async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.user.id;
    const updateData = req.body;

    const team = await teamService.updateTeam(teamId, userId, updateData);

    logger.info(`Team updated successfully: ${teamId}`);
    return res.json({
      message: 'Team updated successfully',
      team
    });
  } catch (error) {
    logger.error('Error updating team:', error);

    if (error.statusCode === 404) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Team not found'
        }
      });
    }

    if (error.statusCode === 403) {
      return res.status(403).json({
        error: {
          code: 'access_denied',
          message: 'Access denied'
        }
      });
    }

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: {
          code: 'validation_error',
          message: 'Validation failed',
          details: error.errors.map((e) => ({
            field: e.path,
            message: e.message
          }))
        }
      });
    }

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to update team'
      }
    });
  }
};

/**
 * Delete team
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteTeam = async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.user.id;

    await teamService.deleteTeam(teamId, userId);

    logger.info(`Team deleted successfully: ${teamId}`);
    return res.json({
      message: 'Team deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting team:', error);

    if (error.statusCode === 404) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Team not found'
        }
      });
    }

    if (error.statusCode === 403) {
      return res.status(403).json({
        error: {
          code: 'access_denied',
          message: 'Access denied'
        }
      });
    }

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to delete team'
      }
    });
  }
};

/**
 * Get team members
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTeamMembers = async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.user.id;
    const options = {
      limit: req.query.limit,
      offset: req.query.offset
    };

    const result = await teamService.getTeamMembers(teamId, userId, options);

    return res.json({
      message: 'Team members retrieved successfully',
      ...result
    });
  } catch (error) {
    logger.error('Error getting team members:', error);

    if (error.statusCode === 403) {
      return res.status(403).json({
        error: {
          code: 'access_denied',
          message: 'Access denied'
        }
      });
    }

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to retrieve team members'
      }
    });
  }
};

/**
 * Add team member
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const addTeamMember = async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.user.id;
    const memberData = req.body;

    const member = await teamService.addTeamMember(teamId, userId, memberData);

    logger.info(`Team member added successfully: ${memberData.user_id} to team ${teamId}`);
    return res.status(201).json({
      message: 'Team member added successfully',
      member
    });
  } catch (error) {
    logger.error('Error adding team member:', error);

    if (error.statusCode === 404) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: error.message
        }
      });
    }

    if (error.statusCode === 403) {
      return res.status(403).json({
        error: {
          code: 'access_denied',
          message: 'Access denied'
        }
      });
    }

    if (error.statusCode === 409) {
      return res.status(409).json({
        error: {
          code: 'conflict',
          message: error.message
        }
      });
    }

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: {
          code: 'validation_error',
          message: 'Validation failed',
          details: error.errors.map((e) => ({
            field: e.path,
            message: e.message
          }))
        }
      });
    }

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to add team member'
      }
    });
  }
};

/**
 * Remove team member
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const removeTeamMember = async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.user.id;
    const memberUserId = req.params.userId;

    await teamService.removeTeamMember(teamId, userId, memberUserId);

    logger.info(`Team member removed successfully: ${memberUserId} from team ${teamId}`);
    return res.json({
      message: 'Team member removed successfully'
    });
  } catch (error) {
    logger.error('Error removing team member:', error);

    if (error.statusCode === 404) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: error.message
        }
      });
    }

    if (error.statusCode === 403) {
      return res.status(403).json({
        error: {
          code: 'access_denied',
          message: 'Access denied'
        }
      });
    }

    if (error.statusCode === 400) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: error.message
        }
      });
    }

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to remove team member'
      }
    });
  }
};

/**
 * Create shared calendar for team
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createSharedCalendar = async (req, res) => {
  try {
    // This is a placeholder for future implementation
    // When calendar integration is enhanced, this would create a shared calendar
    // for the team using the calendar service

    return res.status(501).json({
      error: {
        code: 'not_implemented',
        message: 'Shared calendar creation not yet implemented'
      }
    });
  } catch (error) {
    logger.error('Error creating shared calendar:', error);
    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to create shared calendar'
      }
    });
  }
};

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
