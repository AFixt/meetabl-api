/**
 * Local Database Setup Script
 * Sets up SQLite database for local development
 */

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(dataDir, 'meetabl_dev.sqlite'),
  logging: console.log,
});

async function setupDatabase() {
  try {
    console.log('🔧 Setting up local development database...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Create basic table structure (simplified for demo)
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        timezone TEXT DEFAULT 'America/New_York',
        language TEXT DEFAULT 'en',
        phoneNumber TEXT,
        created DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        startTime DATETIME NOT NULL,
        endTime DATETIME NOT NULL,
        status TEXT DEFAULT 'confirmed',
        attendeeName TEXT NOT NULL,
        attendeeEmail TEXT NOT NULL,
        attendeePhoneNumber TEXT,
        notes TEXT,
        userId INTEGER,
        created DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS availability_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dayOfWeek INTEGER NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT NOT NULL,
        isActive BOOLEAN DEFAULT true,
        userId INTEGER,
        created DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);
    
    console.log('✅ Database tables created successfully.');
    
    // Insert demo data
    const demoUser = await sequelize.query(`
      INSERT OR IGNORE INTO users (firstName, lastName, email, username, password)
      VALUES ('Demo', 'User', 'demo@meetabl.com', 'demo', 'hashed_password_here')
    `);
    
    console.log('✅ Demo data inserted.');
    console.log('🚀 Local database setup complete!');
    console.log('📄 Database file: ' + path.join(dataDir, 'meetabl_dev.sqlite'));
    
  } catch (error) {
    console.error('❌ Unable to setup database:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

setupDatabase();