const { User, AvailabilityRule } = require('../src/models');
const { sequelize } = require('../src/config/database');
const { v4: uuidv4 } = require('uuid');

async function setupUserAvailability() {
  try {
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
    
    console.log('Setting up availability for:', user.email);
    console.log('User ID:', user.id);
    
    // Check existing rules
    const existingRules = await AvailabilityRule.findAll({
      where: { userId: user.id }
    });
    
    if (existingRules.length > 0) {
      console.log(`User already has ${existingRules.length} availability rules`);
      console.log('Deleting existing rules...');
      await AvailabilityRule.destroy({
        where: { userId: user.id }
      });
    }
    
    // Define standard business hours (Monday-Friday, 9 AM - 5 PM)
    const rules = [
      { dayOfWeek: 1, startTime: '09:00:00', endTime: '17:00:00' }, // Monday
      { dayOfWeek: 2, startTime: '09:00:00', endTime: '17:00:00' }, // Tuesday
      { dayOfWeek: 3, startTime: '09:00:00', endTime: '17:00:00' }, // Wednesday
      { dayOfWeek: 4, startTime: '09:00:00', endTime: '17:00:00' }, // Thursday
      { dayOfWeek: 5, startTime: '09:00:00', endTime: '17:00:00' }, // Friday
    ];
    
    // Create each rule
    for (const rule of rules) {
      const availabilityRule = await AvailabilityRule.create({
        id: uuidv4(),
        userId: user.id,
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        bufferMinutes: 15, // 15 minutes buffer between meetings
        maxBookingsPerDay: null // No limit
      });
      
      const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      console.log(`✅ Created rule for ${dayNames[rule.dayOfWeek]}: ${rule.startTime} - ${rule.endTime}`);
    }
    
    // Verify the rules were created
    const userRules = await AvailabilityRule.findAll({
      where: { userId: user.id }
    });
    
    console.log(`\n✅ Successfully created ${userRules.length} availability rules for ${user.email}`);
    console.log('\nAvailability Summary:');
    console.log('- Monday-Friday: 9:00 AM - 5:00 PM');
    console.log('- Buffer time: 15 minutes between meetings');
    console.log('- Max bookings per day: Unlimited');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

setupUserAvailability();