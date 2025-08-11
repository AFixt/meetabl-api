/**
 * Local Development Database Configuration
 * Uses SQLite for easier local development without requiring MySQL setup
 */

const path = require('path');

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../data/meetabl_dev.sqlite'),
    logging: console.log,
    define: {
      timestamps: true,
      underscored: false,
      createdAt: 'created',
      updatedAt: 'updated'
    },
    pool: {
      max: 1,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
    define: {
      timestamps: true,
      underscored: false,
      createdAt: 'created',
      updatedAt: 'updated'
    }
  }
};