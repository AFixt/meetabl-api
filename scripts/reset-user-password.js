const bcrypt = require('bcrypt');
const { User } = require('../src/models');
const { sequelize } = require('../src/config/database');

async function resetPassword() {
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
    
    // Set a new password: "Test1234!"
    const newPassword = 'Test1234!';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update the user's password
    user.password = hashedPassword;
    user.password_reset_token = null;
    user.password_reset_expires = null;
    await user.save();
    
    console.log('Password has been reset to: Test1234!');
    console.log('Password hash saved:', hashedPassword);
    
    // Verify the password works
    const isValid = await bcrypt.compare(newPassword, hashedPassword);
    console.log('Password verification test:', isValid ? 'PASSED' : 'FAILED');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetPassword();