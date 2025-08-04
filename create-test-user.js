const { User, UserSettings } = require('./src/models');
const { v4: uuidv4 } = require('uuid');

async function createTestUser() {
  try {
    const userId = uuidv4();
    
    // Delete existing test user if exists
    await User.destroy({ where: { email: 'test@example.com' } });
    
    // Create new test user - the password will be hashed by the model hook
    const user = await User.create({
      id: userId,
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      username: 'testuser',
      password: 'Test123!@#',  // This will be hashed automatically
      timezone: 'UTC',
      email_verified: true
    });
    
    // Create user settings
    await UserSettings.create({
      id: uuidv4(),
      userId: userId
    });
    
    console.log('Test user created successfully');
    console.log('Email: test@example.com');
    console.log('Password: Test123!@#');
    console.log('User ID:', userId);
    
  } catch (error) {
    console.error('Error creating test user:', error.message);
    console.error('Stack:', error.stack);
  }
  process.exit(0);
}

createTestUser();