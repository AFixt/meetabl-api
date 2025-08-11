'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Update all basic plan users to have max_event_types = 999 (unlimited)
    await queryInterface.sequelize.query(`
      UPDATE users
      SET max_event_types = 999
      WHERE plan_type = 'basic'
    `);
    
    // Ensure free plan users have max_event_types = 1
    await queryInterface.sequelize.query(`
      UPDATE users
      SET max_event_types = 1
      WHERE plan_type = 'free'
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Revert changes - this is just for rollback purposes
    await queryInterface.sequelize.query(`
      UPDATE users
      SET max_event_types = 999
      WHERE plan_type = 'basic'
    `);
    
    await queryInterface.sequelize.query(`
      UPDATE users
      SET max_event_types = 1
      WHERE plan_type = 'free'
    `);
  }
};