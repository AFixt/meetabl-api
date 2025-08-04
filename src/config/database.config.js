require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: true,
    define: {
      timestamps: true,
      underscored: false,
      createdAt: 'created',
      updatedAt: 'updated'
    },
    dialectOptions: {
      dateStrings: true,
      typeCast: true,
      connectTimeout: 60000,
      acquireTimeout: 60000,
      timeout: 60000,
      charset: 'utf8mb4'
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    username: process.env.TEST_DB_USER || process.env.DB_USER,
    password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.TEST_DB_NAME || 'meetabl_test',
    host: process.env.TEST_DB_HOST || process.env.DB_HOST,
    port: process.env.TEST_DB_PORT || process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    define: {
      timestamps: true,
      underscored: false,
      createdAt: 'created',
      updatedAt: 'updated'
    },
    dialectOptions: {
      dateStrings: true,
      typeCast: true,
      connectTimeout: 60000,
      acquireTimeout: 60000,
      timeout: 60000,
      charset: 'utf8mb4'
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    define: {
      timestamps: true,
      underscored: false,
      createdAt: 'created',
      updatedAt: 'updated'
    },
    dialectOptions: {
      dateStrings: true,
      typeCast: true,
      connectTimeout: 60000,
      acquireTimeout: 60000,
      timeout: 60000,
      charset: 'utf8mb4',
      ssl: {
        require: true,
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
      }
    },
    pool: {
      max: 20,
      min: 5,
      acquire: 60000,
      idle: 10000
    }
  }
};