const fs = require('fs').promises;
const path = require('path');
const { User } = require('../src/models');
const { sequelize } = require('../src/config/database');

async function testEmailTemplate() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connected');
    
    // Find the user
    const user = await User.findOne({
      where: { email: 'karlgroves@gmail.com' }
    });
    
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }
    
    console.log('User found:', user.email);
    console.log('User firstName:', user.firstName);
    console.log('User lastName:', user.lastName);
    
    // Load the password reset email template
    const templatePath = path.join(__dirname, '..', 'src', 'config', 'templates', 'password-reset.html');
    let emailTemplate = await fs.readFile(templatePath, 'utf8');
    
    // Determine the name to use in the greeting (same logic as in notification service)
    const displayName = user.firstName || user.email;
    console.log('\nDisplay name to be used in email:', displayName);
    
    // Replace template variables
    const testResetUrl = 'http://localhost:5173/reset-password?token=TEST_TOKEN';
    emailTemplate = emailTemplate
      .replace(/{{name}}/g, displayName)
      .replace(/{{resetUrl}}/g, testResetUrl);
    
    // Check if the greeting is correct
    const greetingMatch = emailTemplate.match(/<p>Hi ([^,]+),<\/p>/);
    if (greetingMatch) {
      console.log('\n✅ Email greeting: "Hi ' + greetingMatch[1] + '"');
      if (greetingMatch[1] === 'undefined') {
        console.log('❌ ERROR: Greeting shows "undefined"!');
      } else if (greetingMatch[1] === displayName) {
        console.log('✅ Greeting is correct!');
      } else {
        console.log('⚠️ WARNING: Greeting doesn\'t match expected name');
      }
    } else {
      console.log('❌ Could not find greeting in email template');
    }
    
    // Test with a user without firstName
    console.log('\n--- Testing with user without firstName ---');
    const testUser = {
      firstName: null,
      email: 'test@example.com'
    };
    const testDisplayName = testUser.firstName || testUser.email;
    console.log('Display name for user without firstName:', testDisplayName);
    
    // Reload template for second test
    emailTemplate = await fs.readFile(templatePath, 'utf8');
    emailTemplate = emailTemplate
      .replace(/{{name}}/g, testDisplayName)
      .replace(/{{resetUrl}}/g, testResetUrl);
    
    const testGreetingMatch = emailTemplate.match(/<p>Hi ([^,]+),<\/p>/);
    if (testGreetingMatch) {
      console.log('Email greeting: "Hi ' + testGreetingMatch[1] + '"');
      if (testGreetingMatch[1] === testDisplayName) {
        console.log('✅ Greeting shows email address when firstName is not available!');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testEmailTemplate();