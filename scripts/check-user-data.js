const { User, CalendarToken, AvailabilityRule } = require('../src/models');
const { sequelize } = require('../src/config/database');

async function checkUserData() {
  try {
    await sequelize.authenticate();
    console.log('Database connected');
    
    const user = await User.findOne({ 
      where: { email: 'karlgroves@gmail.com' } 
    });
    
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }
    
    console.log('=== USER INFO ===');
    console.log('User ID:', user.id);
    console.log('User email:', user.email);
    console.log('User name:', user.firstName, user.lastName);
    console.log('Created:', user.created);
    
    // Check calendar tokens
    const calendarTokens = await CalendarToken.findAll({
      where: { userId: user.id }
    });
    
    console.log('\n=== CALENDAR TOKENS ===');
    console.log('Total:', calendarTokens.length);
    if (calendarTokens.length > 0) {
      calendarTokens.forEach(token => {
        console.log('- Provider:', token.provider);
        console.log('  Email:', token.email);
        console.log('  Created:', token.created);
      });
    } else {
      console.log('No calendar tokens found');
    }
    
    // Check availability rules
    const availabilityRules = await AvailabilityRule.findAll({
      where: { userId: user.id }
    });
    
    console.log('\n=== AVAILABILITY RULES ===');
    console.log('Total:', availabilityRules.length);
    if (availabilityRules.length > 0) {
      availabilityRules.forEach(rule => {
        console.log('- Day:', rule.dayOfWeek);
        console.log('  Time:', rule.startTime, '-', rule.endTime);
        console.log('  Buffer:', rule.bufferMinutes, 'minutes');
      });
    } else {
      console.log('No availability rules found');
    }
    
    // Let's also check if there are ANY availability rules in the database
    const allRules = await AvailabilityRule.findAll();
    console.log('\n=== ALL AVAILABILITY RULES IN DATABASE ===');
    console.log('Total rules for all users:', allRules.length);
    
    // Check if there are ANY calendar tokens in the database
    const allTokens = await CalendarToken.findAll();
    console.log('\n=== ALL CALENDAR TOKENS IN DATABASE ===');
    console.log('Total tokens for all users:', allTokens.length);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUserData();