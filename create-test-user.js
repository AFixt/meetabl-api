const { User, UserSettings } = require('./src/models');
const { v4: uuidv4 } = require('uuid');

async function createTestUser() {
  try {
    const userId = uuidv4();
    
    // Delete existing test user if exists
    await User.destroy({ where: { email: 'karlgroves@gmail.com' } });
    
    // Create new test user - the password will be hashed by the model hook
    const user = await User.create({
      id: userId,
      firstName: 'Karl',
      lastName: 'Groves',
      email: 'karlgroves@gmail.com',
      username: 'karlgroves',
      password: 'newPassword',  // This will be hashed automatically
      timezone: 'UTC',
      subscription_plan: 'basic',  // Set to Basic plan for billing test
      email_verified: true
    });
    
    // Create user settings
    await UserSettings.create({
      id: uuidv4(),
      userId: userId
    });
    
    console.log('Billing test user created successfully');
    console.log('Email: karlgroves@gmail.com');
    console.log('Password: newPassword');
    console.log('User ID:', userId);
    
  } catch (error) {
    console.error('Error creating test user:', error.message);
    console.error('Stack:', error.stack);
  }
  process.exit(0);
}

createTestUser();