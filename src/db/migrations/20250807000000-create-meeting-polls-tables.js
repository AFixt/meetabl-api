/**
 * Migration: Create meeting polls tables
 * 
 * Creates the database structure for meeting polls feature
 * - polls: Main poll information
 * - poll_time_slots: Available time slots for each poll  
 * - poll_votes: User votes on time slots
 * 
 * @author meetabl Team
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Create polls table
      await queryInterface.createTable('polls', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        title: {
          type: Sequelize.STRING(200),
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        duration_minutes: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 60
        },
        timezone: {
          type: Sequelize.STRING(100),
          allowNull: false,
          defaultValue: 'UTC'
        },
        deadline: {
          type: Sequelize.DATE,
          allowNull: true
        },
        max_votes_per_participant: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 3
        },
        allow_anonymous_votes: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        require_participant_details: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        status: {
          type: Sequelize.ENUM('active', 'closed', 'finalized'),
          allowNull: false,
          defaultValue: 'active'
        },
        selected_time_slot_id: {
          type: Sequelize.UUID,
          allowNull: true
        },
        poll_url_token: {
          type: Sequelize.STRING(100),
          allowNull: false,
          unique: true
        },
        notification_settings: {
          type: Sequelize.JSON,
          allowNull: true,
          defaultValue: {
            notify_on_vote: true,
            notify_on_deadline: true,
            notify_participants_on_finalization: true
          }
        },
        created: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      }, { transaction });

      // Create poll_time_slots table
      await queryInterface.createTable('poll_time_slots', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false
        },
        poll_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'polls',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        start_time: {
          type: Sequelize.DATE,
          allowNull: false
        },
        end_time: {
          type: Sequelize.DATE,
          allowNull: false
        },
        vote_count: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        is_available: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        created: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      }, { transaction });

      // Create poll_votes table
      await queryInterface.createTable('poll_votes', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false
        },
        poll_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'polls',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        poll_time_slot_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'poll_time_slots',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        participant_name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        participant_email: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        participant_identifier: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: 'Hash of email for anonymous voting or email for identified voting'
        },
        created: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      }, { transaction });

      // Add indexes for performance
      await queryInterface.addIndex('polls', ['user_id'], { transaction });
      await queryInterface.addIndex('polls', ['poll_url_token'], { 
        unique: true, 
        transaction 
      });
      await queryInterface.addIndex('polls', ['status'], { transaction });
      await queryInterface.addIndex('polls', ['deadline'], { transaction });

      await queryInterface.addIndex('poll_time_slots', ['poll_id'], { transaction });
      await queryInterface.addIndex('poll_time_slots', ['start_time'], { transaction });
      await queryInterface.addIndex('poll_time_slots', ['is_available'], { transaction });

      await queryInterface.addIndex('poll_votes', ['poll_id'], { transaction });
      await queryInterface.addIndex('poll_votes', ['poll_time_slot_id'], { transaction });
      await queryInterface.addIndex('poll_votes', ['participant_identifier'], { transaction });
      await queryInterface.addIndex('poll_votes', ['poll_id', 'participant_identifier'], { 
        transaction 
      });

      // Add foreign key constraint for selected_time_slot_id after poll_time_slots table is created
      await queryInterface.addConstraint('polls', {
        fields: ['selected_time_slot_id'],
        type: 'foreign key',
        name: 'polls_selected_time_slot_fk',
        references: {
          table: 'poll_time_slots',
          field: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove foreign key constraint first
      await queryInterface.removeConstraint('polls', 'polls_selected_time_slot_fk', { transaction });

      // Drop tables in reverse order
      await queryInterface.dropTable('poll_votes', { transaction });
      await queryInterface.dropTable('poll_time_slots', { transaction });
      await queryInterface.dropTable('polls', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};