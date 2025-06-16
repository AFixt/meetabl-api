/**
 * Team routes
 *
 * Defines routes for team/organization management
 *
 * @author meetabl Team
 */

const express = require('express');
const { authenticateJWT } = require('../middlewares/auth');
const {
  validateGetRequest,
  validateUuid,
  validateTeam,
  validateTeamMember,
  validateUserIdParam
} = require('../middlewares/validation');
const teamController = require('../controllers/team.controller');

const router = express.Router();

// All team routes require authentication
router.use(authenticateJWT);

/**
 * @route POST /api/teams
 * @desc Create a new team
 * @access Private
 */
router.post('/', validateTeam, teamController.createTeam);

/**
 * @route GET /api/teams
 * @desc Get user's teams
 * @access Private
 */
router.get('/', validateGetRequest, teamController.getUserTeams);

/**
 * @route GET /api/teams/:id
 * @desc Get team details
 * @access Private
 */
router.get('/:id', validateUuid, teamController.getTeam);

/**
 * @route PUT /api/teams/:id
 * @desc Update team
 * @access Private
 */
router.put('/:id', validateUuid, validateTeam, teamController.updateTeam);

/**
 * @route DELETE /api/teams/:id
 * @desc Delete team
 * @access Private
 */
router.delete('/:id', validateUuid, teamController.deleteTeam);

/**
 * @route GET /api/teams/:id/members
 * @desc Get team members
 * @access Private
 */
router.get('/:id/members', validateUuid, validateGetRequest, teamController.getTeamMembers);

/**
 * @route POST /api/teams/:id/members
 * @desc Add team member
 * @access Private
 */
router.post('/:id/members', validateUuid, validateTeamMember, teamController.addTeamMember);

/**
 * @route DELETE /api/teams/:id/members/:userId
 * @desc Remove team member
 * @access Private
 */
router.delete('/:id/members/:userId', validateUuid, validateUserIdParam, teamController.removeTeamMember);

/**
 * @route POST /api/teams/:id/calendars
 * @desc Create shared calendar
 * @access Private
 */
router.post('/:id/calendars', validateUuid, teamController.createSharedCalendar);

module.exports = router;
