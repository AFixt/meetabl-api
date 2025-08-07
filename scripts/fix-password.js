const bcrypt = require('bcrypt');
const { sequelize } = require('../src/config/database');

async function fixPassword() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connected');
    
    // Set a new password: "Test1234!"
    const newPassword = 'Test1234!';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    console.log('New password will be: Test1234!');
    console.log('Generated hash:', hashedPassword);
    
    // Update directly in database to bypass model hooks
    const [results] = await sequelize.query(
      'UPDATE users SET password_hash = :hash WHERE email = :email',
      {
        replacements: {
          hash: hashedPassword,
          email: 'karlgroves@gmail.com'
        }
      }
    );
    
    console.log('Password updated directly in database');
    
    // Verify it was saved correctly
    const [[user]] = await sequelize.query(
      'SELECT password_hash FROM users WHERE email = :email',
      {
        replacements: { email: 'karlgroves@gmail.com' }
      }
    );
    
    console.log('Hash saved in DB:', user.password_hash);
    console.log('Hashes match:', user.password_hash === hashedPassword);
    
    // Test the password
    const isValid = await bcrypt.compare(newPassword, user.password_hash);
    console.log('Password "Test1234!" validation:', isValid ? 'PASSED' : 'FAILED');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixPassword();