/**
 * Migration: Create booking_requests table
 * 
 * Stores pending booking requests that require email confirmation
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('booking_requests', {
      id: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      customer_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      customer_email: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      customer_phone: {
        type: Sequelize.STRING(25),
        allowNull: true
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: false
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: false
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      confirmation_token: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'confirmed', 'expired', 'cancelled'),
        defaultValue: 'pending',
        allowNull: false
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      confirmed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      },
      updated: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('booking_requests', ['user_id']);
    await queryInterface.addIndex('booking_requests', ['confirmation_token']);
    await queryInterface.addIndex('booking_requests', ['status']);
    await queryInterface.addIndex('booking_requests', ['expires_at']);
    await queryInterface.addIndex('booking_requests', ['start_time', 'end_time']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('booking_requests');
  }
};