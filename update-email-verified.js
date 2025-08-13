const { User } = require('./src/models');

async function updateEmailVerified() {
  try {
    console.log('Updating email verification status for demo users...');
    
    const result = await User.update(
      { email_verified: true },
      { 
        where: { 
          email: ['admin@example.com', 'user@example.com'] 
        } 
      }
    );
    
    console.log(`Updated ${result[0]} users to email_verified = true`);
    process.exit(0);
  } catch (error) {
    console.error('Error updating users:', error);
    process.exit(1);
  }
}

updateEmailVerified();
