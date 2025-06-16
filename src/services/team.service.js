/**
 * Team service
 *
 * Business logic for team management operations
 *
 * @author meetabl Team
 */

const logger = require('../config/logger');
const {
  Team, TeamMember, User, AuditLog
} = require('../models');
const { sequelize, Op } = require('../config/database');

/**
 * Create a new team
 * @param {string} userId - The ID of the user creating the team
 * @param {Object} teamData - Team data
 * @returns {Promise<Object>} Created team
 */
const createTeam = async (userId, teamData) => {
  const transaction = await sequelize.transaction();

  try {
    const { name, description } = teamData;

    // Create the team
    const team = await Team.create({
      name,
      description,
      owner_id: userId
    }, { transaction });

    // Add the owner as an admin member
    await TeamMember.create({
      team_id: team.id,
      user_id: userId,
      role: 'admin'
    }, { transaction });

    // Log the action
    await AuditLog.create({
      user_id: userId,
      action: 'team_created',
      resource_type: 'team',
      resource_id: team.id,
      details: { team_name: name }
    }, { transaction });

    await transaction.commit();

    // Return team with owner info
    const createdTeam = await Team.findByPk(team.id, {
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    logger.info(`Team created: ${team.id} by user ${userId}`);
    return createdTeam;
  } catch (error) {
    await transaction.rollback();
    logger.error('Error creating team:', error);
    throw error;
  }
};

/**
 * Get teams for a user (teams they own or are members of)
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Teams data
 */
const getUserTeams = async (userId, options = {}) => {
  try {
    const {
      limit = 100, offset = 0, order = 'created', dir = 'desc'
    } = options;

    // Get teams where user is owner or member
    const teams = await Team.findAndCountAll({
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email']
        },
        {
          model: TeamMember,
          as: 'members',
          where: {
            user_id: userId
          },
          attributes: ['role', 'joined_at'],
          required: true
        }
      ],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [[order, dir.toUpperCase()]],
      distinct: true
    });

    return {
      teams: teams.rows,
      total: teams.count,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    };
  } catch (error) {
    logger.error('Error getting user teams:', error);
    throw error;
  }
};

/**
 * Get team details by ID
 * @param {string} teamId - Team ID
 * @param {string} userId - User ID (for permission check)
 * @returns {Promise<Object>} Team details
 */
const getTeamById = async (teamId, userId) => {
  try {
    const team = await Team.findByPk(teamId, {
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

    if (!team) {
      const error = new Error('Team not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if user is a member of the team
    const isMember = team.members.some((member) => member.user_id === userId);
    if (!isMember) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }

    return team;
  } catch (error) {
    logger.error('Error getting team by ID:', error);
    throw error;
  }
};

/**
 * Update team
 * @param {string} teamId - Team ID
 * @param {string} userId - User ID
 * @param {Object} updateData - Update data
 * @returns {Promise<Object>} Updated team
 */
const updateTeam = async (teamId, userId, updateData) => {
  const transaction = await sequelize.transaction();

  try {
    const team = await Team.findByPk(teamId);

    if (!team) {
      const error = new Error('Team not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if user is owner or admin
    const membership = await TeamMember.findOne({
      where: {
        team_id: teamId,
        user_id: userId,
        role: { [Op.in]: ['admin'] }
      }
    });

    const isOwner = team.owner_id === userId;
    if (!isOwner && !membership) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }

    // Update team
    await team.update(updateData, { transaction });

    // Log the action
    await AuditLog.create({
      user_id: userId,
      action: 'team_updated',
      resource_type: 'team',
      resource_id: teamId,
      details: updateData
    }, { transaction });

    await transaction.commit();

    // Return updated team with owner info
    const updatedTeam = await Team.findByPk(teamId, {
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    logger.info(`Team updated: ${teamId} by user ${userId}`);
    return updatedTeam;
  } catch (error) {
    await transaction.rollback();
    logger.error('Error updating team:', error);
    throw error;
  }
};

/**
 * Delete team
 * @param {string} teamId - Team ID
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const deleteTeam = async (teamId, userId) => {
  const transaction = await sequelize.transaction();

  try {
    const team = await Team.findByPk(teamId);

    if (!team) {
      const error = new Error('Team not found');
      error.statusCode = 404;
      throw error;
    }

    // Only owner can delete team
    if (team.owner_id !== userId) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }

    // Log the action before deletion
    await AuditLog.create({
      user_id: userId,
      action: 'team_deleted',
      resource_type: 'team',
      resource_id: teamId,
      details: { team_name: team.name }
    }, { transaction });

    // Delete team (cascade will handle team members)
    await team.destroy({ transaction });

    await transaction.commit();
    logger.info(`Team deleted: ${teamId} by user ${userId}`);
  } catch (error) {
    await transaction.rollback();
    logger.error('Error deleting team:', error);
    throw error;
  }
};

/**
 * Get team members
 * @param {string} teamId - Team ID
 * @param {string} userId - User ID (for permission check)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Team members data
 */
const getTeamMembers = async (teamId, userId, options = {}) => {
  try {
    const { limit = 100, offset = 0 } = options;

    // Check if user is a member of the team
    const userMembership = await TeamMember.findOne({
      where: {
        team_id: teamId,
        user_id: userId
      }
    });

    if (!userMembership) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }

    const members = await TeamMember.findAndCountAll({
      where: { team_id: teamId },
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email']
        }
      ],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['joined_at', 'ASC']]
    });

    return {
      members: members.rows,
      total: members.count,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    };
  } catch (error) {
    logger.error('Error getting team members:', error);
    throw error;
  }
};

/**
 * Add team member
 * @param {string} teamId - Team ID
 * @param {string} userId - User ID (who is adding)
 * @param {Object} memberData - Member data
 * @returns {Promise<Object>} Added member
 */
const addTeamMember = async (teamId, userId, memberData) => {
  const transaction = await sequelize.transaction();

  try {
    const { user_id: newMemberId, role = 'member' } = memberData;

    // Check if user is owner or admin
    const team = await Team.findByPk(teamId);
    if (!team) {
      const error = new Error('Team not found');
      error.statusCode = 404;
      throw error;
    }

    const userMembership = await TeamMember.findOne({
      where: {
        team_id: teamId,
        user_id: userId,
        role: { [Op.in]: ['admin'] }
      }
    });

    const isOwner = team.owner_id === userId;
    if (!isOwner && !userMembership) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }

    // Check if user exists
    const newMemberUser = await User.findByPk(newMemberId);
    if (!newMemberUser) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if user is already a member
    const existingMembership = await TeamMember.findOne({
      where: {
        team_id: teamId,
        user_id: newMemberId
      }
    });

    if (existingMembership) {
      const error = new Error('User is already a member of this team');
      error.statusCode = 409;
      throw error;
    }

    // Add member
    const member = await TeamMember.create({
      team_id: teamId,
      user_id: newMemberId,
      role
    }, { transaction });

    // Log the action
    await AuditLog.create({
      user_id: userId,
      action: 'team_member_added',
      resource_type: 'team',
      resource_id: teamId,
      details: { added_user_id: newMemberId, role }
    }, { transaction });

    await transaction.commit();

    // Return member with user info
    const addedMember = await TeamMember.findByPk(member.id, {
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    logger.info(`Team member added: ${newMemberId} to team ${teamId} by user ${userId}`);
    return addedMember;
  } catch (error) {
    await transaction.rollback();
    logger.error('Error adding team member:', error);
    throw error;
  }
};

/**
 * Remove team member
 * @param {string} teamId - Team ID
 * @param {string} userId - User ID (who is removing)
 * @param {string} memberUserId - User ID to remove
 * @returns {Promise<void>}
 */
const removeTeamMember = async (teamId, userId, memberUserId) => {
  const transaction = await sequelize.transaction();

  try {
    const team = await Team.findByPk(teamId);
    if (!team) {
      const error = new Error('Team not found');
      error.statusCode = 404;
      throw error;
    }

    // Owner cannot be removed
    if (team.owner_id === memberUserId) {
      const error = new Error('Cannot remove team owner');
      error.statusCode = 400;
      throw error;
    }

    // Check permissions
    const userMembership = await TeamMember.findOne({
      where: {
        team_id: teamId,
        user_id: userId,
        role: { [Op.in]: ['admin'] }
      }
    });

    const isOwner = team.owner_id === userId;
    const isSelfRemoval = userId === memberUserId;

    if (!isOwner && !userMembership && !isSelfRemoval) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }

    // Find and remove membership
    const membership = await TeamMember.findOne({
      where: {
        team_id: teamId,
        user_id: memberUserId
      }
    });

    if (!membership) {
      const error = new Error('Member not found');
      error.statusCode = 404;
      throw error;
    }

    // Log the action before removal
    await AuditLog.create({
      user_id: userId,
      action: 'team_member_removed',
      resource_type: 'team',
      resource_id: teamId,
      details: { removed_user_id: memberUserId }
    }, { transaction });

    await membership.destroy({ transaction });

    await transaction.commit();
    logger.info(`Team member removed: ${memberUserId} from team ${teamId} by user ${userId}`);
  } catch (error) {
    await transaction.rollback();
    logger.error('Error removing team member:', error);
    throw error;
  }
};

module.exports = {
  createTeam,
  getUserTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  addTeamMember,
  removeTeamMember
};
