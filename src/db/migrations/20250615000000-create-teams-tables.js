/**
 * Create teams and team_members tables migration
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Teams table
    await queryInterface.createTable('teams', {
      id: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      owner_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
    });

    // Team members table
    await queryInterface.createTable('team_members', {
      id: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false
      },
      team_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: {
          model: 'teams',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
      role: {
        type: Sequelize.ENUM('admin', 'member'),
        allowNull: false,
        defaultValue: 'member'
      },
      joined_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
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
    });

    // Add unique constraint on team_id + user_id to prevent duplicate memberships
    await queryInterface.addIndex('team_members', ['team_id', 'user_id'], {
      unique: true,
      name: 'unique_team_user'
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('teams', ['owner_id'], {
      name: 'teams_owner_id_index'
    });

    await queryInterface.addIndex('team_members', ['team_id'], {
      name: 'team_members_team_id_index'
    });

    await queryInterface.addIndex('team_members', ['user_id'], {
      name: 'team_members_user_id_index'
    });
  },

  async down(queryInterface) {
    // Drop indexes first
    await queryInterface.removeIndex('team_members', 'team_members_user_id_index');
    await queryInterface.removeIndex('team_members', 'team_members_team_id_index');
    await queryInterface.removeIndex('team_members', 'unique_team_user');
    await queryInterface.removeIndex('teams', 'teams_owner_id_index');

    // Drop tables
    await queryInterface.dropTable('team_members');
    await queryInterface.dropTable('teams');
  }
};
