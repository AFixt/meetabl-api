/**
 * Simple database migration runner that doesn't depend on the full application
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const runMigrations = async () => {
  let connection;
  try {
    console.log('Connecting to database...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('Connected to database');
    
    // Create SequelizeMeta table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS SequelizeMeta (
        name VARCHAR(255) NOT NULL PRIMARY KEY
      )
    `);
    
    // Get executed migrations
    const [executedMigrations] = await connection.execute(
      'SELECT name FROM SequelizeMeta ORDER BY name'
    );
    
    const executedNames = executedMigrations.map(row => row.name);
    console.log('Already executed migrations:', executedNames);
    
    // Get all migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found');
      return { success: true, executed: [], message: 'No migrations to run' };
    }
    
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();
    
    console.log('Available migrations:', migrationFiles);
    
    // Run pending migrations
    const executed = [];
    for (const file of migrationFiles) {
      if (!executedNames.includes(file)) {
        console.log(`Running migration: ${file}`);
        
        try {
          const migrationPath = path.join(migrationsDir, file);
          const migration = require(migrationPath);
          
          // Run the up migration
          if (migration.up) {
            await migration.up({
              sequelize: {
                query: (sql, options) => connection.execute(sql, options?.replacements)
              },
              DataTypes: require('sequelize').DataTypes
            });
            
            // Record migration as executed
            await connection.execute(
              'INSERT INTO SequelizeMeta (name) VALUES (?)',
              [file]
            );
            
            executed.push(file);
            console.log(`Migration ${file} completed`);
          } else {
            console.warn(`Migration ${file} has no 'up' method`);
          }
        } catch (error) {
          console.error(`Migration ${file} failed:`, error);
          throw error;
        }
      }
    }
    
    console.log(`Migrations completed. Executed ${executed.length} migrations.`);
    return {
      success: true,
      executed,
      message: `Successfully ran ${executed.length} migrations`
    };
    
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

exports.handler = async (event, context) => {
  try {
    console.log('Simple migration Lambda started');
    
    // Check for authorization
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (!authHeader || !authHeader.includes('temp-token-123')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }
    
    const result = await runMigrations();
    console.log('Migration completed:', result);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'  
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};