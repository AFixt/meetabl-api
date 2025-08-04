const bcrypt = require('bcrypt');
const { User } = require('./src/models');

async function testLogin() {
  try {
    const user = await User.findOne({ where: { email: 'host-1753997655213@meetabl.com' } });
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('User found:', user.email);
    console.log('Password field value exists:', !!user.password);
    console.log('Password field length:', user.password ? user.password.length : 0);
    
    const testPassword = 'password123';
    const isValid = await bcrypt.compare(testPassword, user.password);
    console.log('Password comparison result:', isValid);
    
    const methodResult = await user.validatePassword(testPassword);
    console.log('validatePassword method result:', methodResult);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
  process.exit(0);
}

testLogin();