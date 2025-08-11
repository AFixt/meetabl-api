const { User, AvailabilityRule } = require('../src/models');
const { v4: uuidv4 } = require('uuid');

async function createAvailabilityRules() {
  try {
    // Find karl-groves user
    const user = await User.findOne({ where: { username: 'karl-groves' } });
    if (!user) {
      console.log('User karl-groves not found');
      return;
    }
    
    console.log('Found user:', user.username, 'ID:', user.id);
    
    // Create availability rules for Monday to Friday, 9 AM to 5 PM
    const days = [1, 2, 3, 4, 5]; // Monday to Friday
    
    for (const day of days) {
      // Check if rule already exists
      const existing = await AvailabilityRule.findOne({
        where: { userId: user.id, dayOfWeek: day }
      });
      
      if (!existing) {
        await AvailabilityRule.create({
          id: uuidv4(),
          userId: user.id,
          dayOfWeek: day,
          startTime: '09:00:00',
          endTime: '17:00:00',
          bufferMinutes: 15,
          maxBookingsPerDay: 10
        });
        console.log('Created availability rule for day', day);
      } else {
        console.log('Availability rule already exists for day', day);
      }
    }
    
    console.log('Availability rules created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating availability rules:', error);
    process.exit(1);
  }
}

createAvailabilityRules();