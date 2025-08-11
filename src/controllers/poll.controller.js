/**
 * Poll controller
 *
 * Handles meeting polls for scheduling meetings with multiple participants
 * Restricted to Professional plan users
 *
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const {
  isValid,
  parseISO,
  isAfter,
  isBefore,
  startOfDay,
  endOfDay,
  addMinutes,
  addDays
} = require('date-fns');
const { toZonedTime, fromZonedTime } = require('date-fns-tz');
const logger = require('../config/logger');
const {
  Poll, PollTimeSlot, PollVote, User, Notification, AuditLog
} = require('../models');
const PollVoteModel = require('../models/poll-vote.model');
const { sequelize } = require('../config/database');
const notificationService = require('../services/notification.service');
const {
  asyncHandler,
  successResponse,
  paginatedResponse,
  validationError,
  notFoundError,
  conflictError
} = require('../utils/error-response');

/**
 * Get all polls for current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserPolls = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  logger.info(`Getting polls for user ${userId}`);

  const {
    limit = 20, offset = 0, order = 'created', dir = 'desc', status
  } = req.query;

  const whereClause = { userId };
  if (status && ['active', 'closed', 'finalized'].includes(status)) {
    whereClause.status = status;
  }

  const polls = await Poll.findAndCountAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[order, dir]],
    include: [
      {
        model: PollTimeSlot,
        as: 'timeSlots',
        attributes: ['id', 'startTime', 'endTime', 'voteCount', 'isAvailable']
      },
      {
        model: PollVote,
        as: 'votes',
        attributes: ['id', 'participantName', 'participantEmail', 'createdAt']
      }
    ]
  });

  // Set pagination headers
  res.set({
    'X-Total-Count': polls.count,
    'X-Total-Pages': Math.ceil(polls.count / limit),
    'X-Per-Page': limit,
    'X-Current-Page': Math.floor(offset / limit) + 1
  });

  logger.info(`Found ${polls.count} polls for user ${userId}`);

  return paginatedResponse(res, polls.rows, {
    page: Math.floor(offset / limit) + 1,
    limit: parseInt(limit),
    total: polls.count
  }, 'Polls retrieved successfully');
});

/**
 * Create a new poll
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createPoll = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    title,
    description,
    durationMinutes = 60,
    timezone,
    deadline,
    maxVotesPerParticipant = 3,
    allowAnonymousVotes = false,
    requireParticipantDetails = true,
    timeSlots,
    notificationSettings = {
      notify_on_vote: true,
      notify_on_deadline: true,
      notify_participants_on_finalization: true
    }
  } = req.body;

  logger.info(`Creating poll for user ${userId}`, { title, timeSlots: timeSlots?.length });

  // Validation
  if (!title || title.trim().length === 0) {
    return validationError(res, 'Poll title is required');
  }

  if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
    return validationError(res, 'At least one time slot is required');
  }

  if (timeSlots.length > 20) {
    return validationError(res, 'Maximum 20 time slots allowed');
  }

  // Validate deadline if provided
  if (deadline) {
    const deadlineDate = parseISO(deadline);
    if (!isValid(deadlineDate) || !isAfter(deadlineDate, new Date())) {
      return validationError(res, 'Deadline must be a valid future date');
    }
  }

  // Validate time slots
  const now = new Date();
  for (let i = 0; i < timeSlots.length; i++) {
    const slot = timeSlots[i];
    const startTime = parseISO(slot.startTime);
    const endTime = parseISO(slot.endTime);

    if (!isValid(startTime) || !isValid(endTime)) {
      return validationError(res, `Time slot ${i + 1} has invalid dates`);
    }

    if (!isAfter(startTime, now)) {
      return validationError(res, `Time slot ${i + 1} start time must be in the future`);
    }

    if (!isAfter(endTime, startTime)) {
      return validationError(res, `Time slot ${i + 1} end time must be after start time`);
    }

    // Check for overlaps with other slots
    for (let j = i + 1; j < timeSlots.length; j++) {
      const otherSlot = timeSlots[j];
      const otherStart = parseISO(otherSlot.startTime);
      const otherEnd = parseISO(otherSlot.endTime);

      if ((startTime < otherEnd) && (endTime > otherStart)) {
        return validationError(res, `Time slot ${i + 1} overlaps with time slot ${j + 1}`);
      }
    }
  }

  const transaction = await sequelize.transaction();

  try {
    // Create poll
    const poll = await Poll.create({
      id: uuidv4(),
      userId,
      title: title.trim(),
      description: description?.trim(),
      durationMinutes,
      timezone: timezone || 'UTC',
      deadline: deadline ? parseISO(deadline) : null,
      maxVotesPerParticipant,
      allowAnonymousVotes,
      requireParticipantDetails,
      notificationSettings
    }, { transaction });

    // Create time slots
    const timeSlotPromises = timeSlots.map(slot => 
      PollTimeSlot.create({
        id: uuidv4(),
        pollId: poll.id,
        startTime: parseISO(slot.startTime),
        endTime: parseISO(slot.endTime)
      }, { transaction })
    );

    await Promise.all(timeSlotPromises);

    // Log creation
    await AuditLog.create({
      userId,
      action: 'poll_created',
      resourceType: 'poll',
      resourceId: poll.id,
      details: { title, timeSlotCount: timeSlots.length }
    }, { transaction });

    await transaction.commit();

    // Fetch the created poll with time slots
    const createdPoll = await Poll.findByPk(poll.id, {
      include: [
        {
          model: PollTimeSlot,
          as: 'timeSlots',
          attributes: ['id', 'startTime', 'endTime', 'voteCount', 'isAvailable']
        }
      ]
    });

    logger.info(`Poll created successfully`, { pollId: poll.id, userId });

    return successResponse(res, createdPoll, 'Poll created successfully', 201);

  } catch (error) {
    await transaction.rollback();
    logger.error('Error creating poll', { error: error.message, userId });
    throw error;
  }
});

/**
 * Get poll by ID (for poll owner)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPoll = asyncHandler(async (req, res) => {
  const { pollId } = req.params;
  const userId = req.user.id;

  const poll = await Poll.findOne({
    where: { id: pollId, userId },
    include: [
      {
        model: PollTimeSlot,
        as: 'timeSlots',
        attributes: ['id', 'startTime', 'endTime', 'voteCount', 'isAvailable']
      },
      {
        model: PollVote,
        as: 'votes',
        attributes: ['id', 'participantName', 'participantEmail', 'pollTimeSlotId', 'createdAt']
      }
    ]
  });

  if (!poll) {
    return notFoundError(res, 'Poll not found');
  }

  // Add poll statistics
  const totalVotes = poll.votes.length;
  const uniqueParticipants = new Set(poll.votes.map(v => v.participantIdentifier)).size;
  
  const pollData = {
    ...poll.toJSON(),
    statistics: {
      totalVotes,
      uniqueParticipants,
      publicUrl: poll.getPublicUrl()
    }
  };

  logger.info(`Poll retrieved`, { pollId, userId });

  return successResponse(res, pollData, 'Poll retrieved successfully');
});

/**
 * Get poll by URL token (public access)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPollByToken = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const poll = await Poll.findOne({
    where: { pollUrlToken: token },
    include: [
      {
        model: PollTimeSlot,
        as: 'timeSlots',
        where: { isAvailable: true },
        attributes: ['id', 'startTime', 'endTime', 'voteCount'],
        required: false
      },
      {
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName', 'timezone']
      }
    ]
  });

  if (!poll) {
    return notFoundError(res, 'Poll not found');
  }

  // Check if poll is still active
  if (!poll.isActive()) {
    return validationError(res, 'This poll is no longer accepting votes');
  }

  // Return limited information for public access
  const publicPollData = {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    durationMinutes: poll.durationMinutes,
    timezone: poll.timezone,
    deadline: poll.deadline,
    maxVotesPerParticipant: poll.maxVotesPerParticipant,
    allowAnonymousVotes: poll.allowAnonymousVotes,
    requireParticipantDetails: poll.requireParticipantDetails,
    status: poll.status,
    timeSlots: poll.timeSlots,
    host: {
      name: `${poll.user.firstName} ${poll.user.lastName}`
    }
  };

  return successResponse(res, publicPollData, 'Poll retrieved successfully');
});

/**
 * Submit votes for a poll (public endpoint)
 * @param {Object} req - Express request object  
 * @param {Object} res - Express response object
 */
const submitVotes = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { participantName, participantEmail, timeSlotIds } = req.body;

  logger.info(`Submitting votes for poll token ${token}`, { 
    participantEmail, 
    timeSlotCount: timeSlotIds?.length 
  });

  // Validation
  if (!participantName || participantName.trim().length === 0) {
    return validationError(res, 'Participant name is required');
  }

  if (!participantEmail || !/\S+@\S+\.\S+/.test(participantEmail)) {
    return validationError(res, 'Valid participant email is required');
  }

  if (!Array.isArray(timeSlotIds) || timeSlotIds.length === 0) {
    return validationError(res, 'At least one time slot must be selected');
  }

  const poll = await Poll.findOne({
    where: { pollUrlToken: token },
    include: [
      {
        model: PollTimeSlot,
        as: 'timeSlots',
        where: { id: { [Op.in]: timeSlotIds } },
        attributes: ['id', 'startTime', 'endTime', 'isAvailable']
      }
    ]
  });

  if (!poll) {
    return notFoundError(res, 'Poll not found');
  }

  // Check if poll is still active
  if (!poll.isActive()) {
    return validationError(res, 'This poll is no longer accepting votes');
  }

  // Check if participant has exceeded vote limit
  if (timeSlotIds.length > poll.maxVotesPerParticipant) {
    return validationError(res, `Maximum ${poll.maxVotesPerParticipant} selections allowed`);
  }

  // Verify all time slots are available
  const unavailableSlots = poll.timeSlots.filter(slot => !slot.isAvailable);
  if (unavailableSlots.length > 0) {
    return validationError(res, 'Some selected time slots are no longer available');
  }

  const participantIdentifier = PollVoteModel.generateParticipantIdentifier(
    participantEmail, 
    poll.id, 
    poll.allowAnonymousVotes
  );

  const transaction = await sequelize.transaction();

  try {
    // Remove existing votes from this participant
    await PollVote.destroy({
      where: { 
        pollId: poll.id, 
        participantIdentifier 
      },
      transaction
    });

    // Create new votes
    const votePromises = timeSlotIds.map(timeSlotId => 
      PollVote.create({
        id: uuidv4(),
        pollId: poll.id,
        pollTimeSlotId: timeSlotId,
        participantName: participantName.trim(),
        participantEmail: participantEmail.toLowerCase().trim(),
        participantIdentifier
      }, { transaction })
    );

    const createdVotes = await Promise.all(votePromises);

    await transaction.commit();

    // Notify poll owner if enabled
    if (poll.notificationSettings?.notify_on_vote) {
      try {
        await notificationService.sendPollVoteNotification(poll.id, {
          participantName: participantName.trim(),
          participantEmail: poll.allowAnonymousVotes ? '[Anonymous]' : participantEmail,
          voteCount: createdVotes.length
        });
      } catch (notificationError) {
        logger.warn('Failed to send poll vote notification', { 
          error: notificationError.message,
          pollId: poll.id
        });
      }
    }

    logger.info(`Votes submitted successfully`, { 
      pollId: poll.id, 
      participantIdentifier: poll.allowAnonymousVotes ? '[Anonymous]' : participantIdentifier,
      voteCount: createdVotes.length 
    });

    return successResponse(res, {
      message: 'Your votes have been recorded successfully',
      voteCount: createdVotes.length
    });

  } catch (error) {
    await transaction.rollback();
    logger.error('Error submitting votes', { 
      error: error.message, 
      pollId: poll.id, 
      participantEmail 
    });
    throw error;
  }
});

/**
 * Update poll
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updatePoll = asyncHandler(async (req, res) => {
  const { pollId } = req.params;
  const userId = req.user.id;
  const updates = req.body;

  const poll = await Poll.findOne({
    where: { id: pollId, userId }
  });

  if (!poll) {
    return notFoundError(res, 'Poll not found');
  }

  // Can't update finalized polls
  if (poll.status === 'finalized') {
    return validationError(res, 'Cannot update a finalized poll');
  }

  // Validate deadline if being updated
  if (updates.deadline) {
    const deadlineDate = parseISO(updates.deadline);
    if (!isValid(deadlineDate) || !isAfter(deadlineDate, new Date())) {
      return validationError(res, 'Deadline must be a valid future date');
    }
  }

  // Only allow certain fields to be updated
  const allowedFields = [
    'title', 'description', 'deadline', 'maxVotesPerParticipant',
    'allowAnonymousVotes', 'requireParticipantDetails', 'notificationSettings'
  ];

  const filteredUpdates = {};
  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });

  await poll.update(filteredUpdates);

  // Log update
  await AuditLog.create({
    userId,
    action: 'poll_updated',
    resourceType: 'poll',
    resourceId: poll.id,
    details: filteredUpdates
  });

  logger.info(`Poll updated`, { pollId, userId, updates: Object.keys(filteredUpdates) });

  return successResponse(res, poll, 'Poll updated successfully');
});

/**
 * Finalize poll with selected time slot
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const finalizePoll = asyncHandler(async (req, res) => {
  const { pollId } = req.params;
  const { selectedTimeSlotId } = req.body;
  const userId = req.user.id;

  if (!selectedTimeSlotId) {
    return validationError(res, 'Selected time slot is required');
  }

  const poll = await Poll.findOne({
    where: { id: pollId, userId },
    include: [
      {
        model: PollTimeSlot,
        as: 'timeSlots',
        attributes: ['id', 'startTime', 'endTime', 'voteCount']
      }
    ]
  });

  if (!poll) {
    return notFoundError(res, 'Poll not found');
  }

  if (!poll.canBeFinalized()) {
    return validationError(res, 'Poll cannot be finalized');
  }

  // Verify selected time slot belongs to this poll
  const selectedSlot = poll.timeSlots.find(slot => slot.id === selectedTimeSlotId);
  if (!selectedSlot) {
    return validationError(res, 'Invalid time slot selection');
  }

  const transaction = await sequelize.transaction();

  try {
    // Update poll status and selected time slot
    await poll.update({
      status: 'finalized',
      selectedTimeSlotId
    }, { transaction });

    // Log finalization
    await AuditLog.create({
      userId,
      action: 'poll_finalized',
      resourceType: 'poll',
      resourceId: poll.id,
      details: { selectedTimeSlotId, selectedTime: selectedSlot.startTime }
    }, { transaction });

    await transaction.commit();

    // Notify participants if enabled
    if (poll.notificationSettings?.notify_participants_on_finalization) {
      try {
        await notificationService.sendPollFinalizationNotification(poll.id, selectedSlot);
      } catch (notificationError) {
        logger.warn('Failed to send poll finalization notifications', {
          error: notificationError.message,
          pollId: poll.id
        });
      }
    }

    logger.info(`Poll finalized`, { pollId, userId, selectedTimeSlotId });

    return successResponse(res, poll, 'Poll finalized successfully');

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Close poll (stop accepting votes)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const closePoll = asyncHandler(async (req, res) => {
  const { pollId } = req.params;
  const userId = req.user.id;

  const poll = await Poll.findOne({
    where: { id: pollId, userId }
  });

  if (!poll) {
    return notFoundError(res, 'Poll not found');
  }

  if (poll.status !== 'active') {
    return validationError(res, 'Only active polls can be closed');
  }

  await poll.update({ status: 'closed' });

  // Log closure
  await AuditLog.create({
    userId,
    action: 'poll_closed',
    resourceType: 'poll',
    resourceId: poll.id,
    details: {}
  });

  logger.info(`Poll closed`, { pollId, userId });

  return successResponse(res, poll, 'Poll closed successfully');
});

/**
 * Delete poll
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deletePoll = asyncHandler(async (req, res) => {
  const { pollId } = req.params;
  const userId = req.user.id;

  const poll = await Poll.findOne({
    where: { id: pollId, userId }
  });

  if (!poll) {
    return notFoundError(res, 'Poll not found');
  }

  // Can't delete finalized polls
  if (poll.status === 'finalized') {
    return validationError(res, 'Cannot delete a finalized poll');
  }

  const transaction = await sequelize.transaction();

  try {
    // Cascading delete will handle time slots and votes
    await poll.destroy({ transaction });

    // Log deletion
    await AuditLog.create({
      userId,
      action: 'poll_deleted',
      resourceType: 'poll',
      resourceId: poll.id,
      details: { title: poll.title }
    }, { transaction });

    await transaction.commit();

    logger.info(`Poll deleted`, { pollId, userId });

    return successResponse(res, null, 'Poll deleted successfully');

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

module.exports = {
  getUserPolls,
  createPoll,
  getPoll,
  getPollByToken,
  submitVotes,
  updatePoll,
  finalizePoll,
  closePoll,
  deletePoll
};