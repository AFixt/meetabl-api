/**
 * Simple demo data seeder script for local development
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// Use the database configuration
const { sequelize } = require('../src/config/database');

async function seedDemoData() {
  try {
    console.log('🌱 Seeding demo data for local development...');

    // Create demo user with hashed password
    const hashedPassword = await bcrypt.hash('password123', 10);
    const userId = uuidv4();

    // Insert demo user using raw SQL for simplicity
    await sequelize.query(`
      INSERT OR REPLACE INTO users (id, name, email, password_hash, timezone, calendar_provider, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, {
      replacements: [
        userId,
        'Demo User',
        'demo@meetabl.com',
        hashedPassword,
        'America/New_York',
        'none',
        new Date(),
        new Date()
      ]
    });

    console.log('✅ Demo user created: demo@meetabl.com / password123');

    // Create user settings
    const settingsId = uuidv4();
    await sequelize.query(`
      INSERT OR REPLACE INTO user_settings (id, user_id, branding_color, confirmation_email_copy, accessibility_mode, alt_text_enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `, {
      replacements: [
        settingsId,
        userId,
        '#1976d2',
        'Thank you for booking with us!',
        1,
        1
      ]
    });

    // Create availability rules (Monday-Friday, 9AM-5PM)
    const weekdays = [1, 2, 3, 4, 5]; // Monday to Friday
    for (const dayOfWeek of weekdays) {
      await sequelize.query(`
        INSERT OR REPLACE INTO availability_rules (id, user_id, day_of_week, start_time, end_time, buffer_minutes, max_bookings_per_day)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, {
        replacements: [
          uuidv4(),
          userId,
          dayOfWeek,
          '09:00:00',
          '17:00:00',
          15,
          10
        ]
      });
    }

    console.log('✅ Availability rules created (Monday-Friday, 9AM-5PM)');

    // Create a sample booking for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    
    const endTime = new Date(tomorrow);
    endTime.setMinutes(endTime.getMinutes() + 30);

    await sequelize.query(`
      INSERT OR REPLACE INTO bookings (id, user_id, customer_name, customer_email, start_time, end_time, status, created)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, {
      replacements: [
        uuidv4(),
        userId,
        'John Smith',
        'john.smith@example.com',
        tomorrow,
        endTime,
        'confirmed',
        new Date()
      ]
    });

    console.log('✅ Sample booking created for tomorrow 10:00 AM');

    console.log('🚀 Demo data seeding complete!');
    console.log('');
    console.log('Demo user credentials:');
    console.log('  Email: demo@meetabl.com');
    console.log('  Password: password123');
    console.log('');
    console.log('You can now log in to test the application.');

  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the seeder
seedDemoData();