const crypto = require('crypto');
const { User } = require('../src/models');
const { sequelize } = require('../src/config/database');

async function checkToken() {
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
    console.log('Reset token stored:', user.password_reset_token);
    console.log('Reset expires:', user.password_reset_expires);
    console.log('Expires in future?', user.password_reset_expires > new Date());
    
    // Test with a sample token
    const testToken = 'dbc2cdd4ecf73a5324d9c487be3acc64770cf5bd750b30032f5a04afe88196eb';
    const hashedTest = crypto.createHash('sha256').update(testToken).digest('hex');
    console.log('\nTest token:', testToken);
    console.log('Test token hashed:', hashedTest);
    console.log('Matches stored?', hashedTest === user.password_reset_token);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkToken();