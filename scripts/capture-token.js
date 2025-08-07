const crypto = require('crypto');
const { User } = require('../src/models');
const { sequelize } = require('../src/config/database');
const { generatePasswordResetToken } = require('../src/utils/crypto');

async function captureToken() {
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
    
    // Generate a new token like the forgot password does
    const resetToken = generatePasswordResetToken();
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    console.log('\n=== NEW TOKEN GENERATION ===');
    console.log('Plain token (sent in email):', resetToken);
    console.log('Hashed token (stored in DB):', hashedToken);
    
    // Save it to the user
    user.password_reset_token = hashedToken;
    user.password_reset_expires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();
    
    console.log('\n=== SAVED TO DATABASE ===');
    console.log('Token saved successfully');
    console.log('Expires at:', user.password_reset_expires);
    
    console.log('\n=== TEST RESET URL ===');
    console.log(`http://localhost:5173/reset-password?token=${resetToken}`);
    
    console.log('\n=== VERIFICATION ===');
    // Now test if we can find the user with the token
    const testHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const foundUser = await User.findOne({
      where: {
        password_reset_token: testHash,
        email: 'karlgroves@gmail.com'
      }
    });
    
    console.log('Can find user with token?', !!foundUser);
    if (foundUser) {
      console.log('Found user:', foundUser.email);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

captureToken();