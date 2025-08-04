'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('event_types', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30
      },
      color: {
        type: Sequelize.STRING(7),
        allowNull: false,
        defaultValue: '#1976d2'
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      location_type: {
        type: Sequelize.ENUM('in_person', 'phone', 'video', 'custom'),
        allowNull: false,
        defaultValue: 'video'
      },
      requires_confirmation: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      buffer_before: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      buffer_after: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      minimum_notice: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 120
      },
      maximum_advance: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 43200
      },
      questions: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: []
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      position: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes
    await queryInterface.addIndex('event_types', ['user_id']);
    await queryInterface.addIndex('event_types', ['user_id', 'slug'], {
      unique: true
    });
    await queryInterface.addIndex('event_types', ['is_active']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('event_types');
  }
};