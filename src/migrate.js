/**
 * Database migration runner for AWS Lambda
 * This script can be invoked through the API to run migrations
 */

const { Sequelize } = require('sequelize');
const Umzug = require('umzug');
const path = require('path');

exports.runMigrations = async () => {
  console.log('Starting database migrations...');
  
  // Create Sequelize instance with environment variables
  const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      logging: console.log,
      dialectOptions: {
        connectTimeout: 60000,
        ssl: process.env.NODE_ENV === 'production' ? {
          require: true,
          rejectUnauthorized: false
        } : false
      }
    }
  );

  // Test connection
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }

  // Configure Umzug for migrations
  const umzug = new Umzug({
    migrations: {
      path: path.join(__dirname, '../migrations'),
      params: [
        sequelize.getQueryInterface(),
        Sequelize
      ]
    },
    storage: 'sequelize',
    storageOptions: {
      sequelize: sequelize,
      tableName: 'SequelizeMeta'
    }
  });

  try {
    // Run pending migrations
    const migrations = await umzug.pending();
    console.log(`Found ${migrations.length} pending migrations`);
    
    const executed = await umzug.up();
    console.log(`Successfully ran ${executed.length} migrations:`, executed.map(m => m.file));
    
    return {
      success: true,
      executed: executed.map(m => m.file),
      message: `Successfully ran ${executed.length} migrations`
    };
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
};

// Lambda handler
exports.handler = async (event, context) => {
  try {
    const result = await exports.runMigrations();
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Migration error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    };
  }
};