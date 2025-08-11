/**
 * Pricing Rule controller
 *
 * Handles pricing rule management for users
 *
 * @author meetabl Team
 */

const { validationResult } = require('express-validator');
const logger = require('../config/logger');
const { PricingRule, AuditLog } = require('../models');
const { sequelize, Op } = require('../config/database');

/**
 * Get all pricing rules for current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPricingRules = async (req, res) => {
  try {
    const userId = req.user.id;
    const { is_active } = req.query;

    // Build query conditions
    const where = { user_id: userId };
    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }

    const pricingRules = await PricingRule.findAll({
      where,
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      message: 'Pricing rules retrieved successfully',
      data: pricingRules
    });
  } catch (error) {
    logger.error('Error getting pricing rules:', error);
    return res.status(500).json({
      error: 'Failed to retrieve pricing rules',
      message: error.message
    });
  }
};

/**
 * Create a new pricing rule
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createPricingRule = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user.id;
    const { name, description, price_per_slot, currency, is_active } = req.body;

    // If setting as active, deactivate other rules
    if (is_active) {
      await PricingRule.update(
        { is_active: false },
        { 
          where: { user_id: userId },
          transaction
        }
      );
    }

    // Create new pricing rule
    const pricingRule = await PricingRule.create({
      user_id: userId,
      name,
      description,
      price_per_slot,
      currency: currency || 'USD',
      is_active: is_active || false
    }, { transaction });

    // Log the action
    await AuditLog.create({
      user_id: userId,
      action: 'pricing_rule_created',
      entity_type: 'pricing_rule',
      entity_id: pricingRule.id,
      metadata: JSON.stringify({
        name,
        price_per_slot,
        currency: pricingRule.currency
      })
    }, { transaction });

    await transaction.commit();

    logger.info(`Pricing rule created by user ${userId}`);

    return res.status(201).json({
      message: 'Pricing rule created successfully',
      data: pricingRule
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error creating pricing rule:', error);
    return res.status(500).json({
      error: 'Failed to create pricing rule',
      message: error.message
    });
  }
};

/**
 * Update a pricing rule
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updatePricingRule = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user.id;
    const { id } = req.params;
    const updates = req.body;

    // Find pricing rule
    const pricingRule = await PricingRule.findOne({
      where: { id, user_id: userId },
      transaction
    });

    if (!pricingRule) {
      await transaction.rollback();
      return res.status(404).json({
        error: 'Pricing rule not found'
      });
    }

    // If setting as active, deactivate other rules
    if (updates.is_active && !pricingRule.is_active) {
      await PricingRule.update(
        { is_active: false },
        { 
          where: { 
            user_id: userId,
            id: { [Op.ne]: id }
          },
          transaction
        }
      );
    }

    // Update pricing rule
    await pricingRule.update(updates, { transaction });

    // Log the action
    await AuditLog.create({
      user_id: userId,
      action: 'pricing_rule_updated',
      entity_type: 'pricing_rule',
      entity_id: pricingRule.id,
      metadata: JSON.stringify(updates)
    }, { transaction });

    await transaction.commit();

    logger.info(`Pricing rule ${id} updated by user ${userId}`);

    return res.status(200).json({
      message: 'Pricing rule updated successfully',
      data: pricingRule
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error updating pricing rule:', error);
    return res.status(500).json({
      error: 'Failed to update pricing rule',
      message: error.message
    });
  }
};

/**
 * Delete a pricing rule
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deletePricingRule = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find pricing rule
    const pricingRule = await PricingRule.findOne({
      where: { id, user_id: userId },
      transaction
    });

    if (!pricingRule) {
      await transaction.rollback();
      return res.status(404).json({
        error: 'Pricing rule not found'
      });
    }

    // Check if it's the only active rule
    if (pricingRule.is_active) {
      const activeCount = await PricingRule.count({
        where: { 
          user_id: userId,
          is_active: true
        },
        transaction
      });

      if (activeCount === 1) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Cannot delete the only active pricing rule'
        });
      }
    }

    // Delete pricing rule
    await pricingRule.destroy({ transaction });

    // Log the action
    await AuditLog.create({
      user_id: userId,
      action: 'pricing_rule_deleted',
      entity_type: 'pricing_rule',
      entity_id: id,
      metadata: JSON.stringify({
        name: pricingRule.name
      })
    }, { transaction });

    await transaction.commit();

    logger.info(`Pricing rule ${id} deleted by user ${userId}`);

    return res.status(200).json({
      message: 'Pricing rule deleted successfully'
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error deleting pricing rule:', error);
    return res.status(500).json({
      error: 'Failed to delete pricing rule',
      message: error.message
    });
  }
};

module.exports = {
  getPricingRules,
  createPricingRule,
  updatePricingRule,
  deletePricingRule
};