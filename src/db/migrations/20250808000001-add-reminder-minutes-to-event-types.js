'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('event_types', 'reminder_minutes', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 15,
      comment: 'Reminder time before event in minutes',
      after: 'maximum_advance'
    });

    // Add validation constraint
    await queryInterface.addConstraint('event_types', {
      fields: ['reminder_minutes'],
      type: 'check',
      name: 'event_types_reminder_minutes_check',
      where: {
        reminder_minutes: {
          [Sequelize.Op.and]: [
            { [Sequelize.Op.gte]: 0 },
            { [Sequelize.Op.lte]: 10080 } // 7 days max
          ]
        }
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the constraint first
    await queryInterface.removeConstraint('event_types', 'event_types_reminder_minutes_check');
    
    // Then remove the column
    await queryInterface.removeColumn('event_types', 'reminder_minutes');
  }
};