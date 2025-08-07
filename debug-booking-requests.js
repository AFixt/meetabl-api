const { BookingRequest, User, Booking } = require('./src/models');

(async () => {
  try {
    // Find a user to book with
    const user = await User.findOne({ where: { username: 'karl-groves' } });
    if (!user) {
      console.log('User karl-groves not found');
      process.exit(1);
    }
    
    console.log(`\n=== Checking bookings for user ${user.username} (${user.id}) ===\n`);
    
    // Check recent booking requests
    const recentRequests = await BookingRequest.findAll({
      where: { userId: user.id },
      order: [['created', 'DESC']],
      limit: 10
    });
    
    console.log(`Found ${recentRequests.length} booking requests:\n`);
    
    for (const req of recentRequests) {
      console.log(`Token: ${req.confirmationToken.substring(0, 20)}...`);
      console.log(`  Status: ${req.status}`);
      console.log(`  Customer: ${req.customerEmail}`);
      console.log(`  Time: ${req.startTime} to ${req.endTime}`);
      console.log(`  Created: ${req.createdAt}`);
      console.log(`  Expires: ${req.expiresAt}`);
      console.log(`  Confirmed: ${req.confirmedAt || 'Not confirmed'}`);
      
      // Check if there's a corresponding booking
      const booking = await Booking.findOne({
        where: {
          customerEmail: req.customerEmail,
          startTime: req.startTime
        }
      });
      
      if (booking) {
        console.log(`  ⚠️  BOOKING EXISTS: ${booking.id} (status: ${booking.status})`);
      }
      
      console.log('---');
    }
    
    // Check if there are any confirmed bookings without requests
    const confirmedBookings = await Booking.findAll({
      where: {
        userId: user.id,
        status: 'confirmed'
      },
      order: [['created', 'DESC']],
      limit: 5
    });
    
    console.log(`\n=== Confirmed Bookings (${confirmedBookings.length} total) ===\n`);
    
    for (const booking of confirmedBookings) {
      console.log(`Booking ID: ${booking.id}`);
      console.log(`  Customer: ${booking.customerEmail}`);
      console.log(`  Time: ${booking.startTime} to ${booking.endTime}`);
      console.log(`  Created: ${booking.createdAt}`);
      
      // Check if there's a corresponding request
      const request = await BookingRequest.findOne({
        where: {
          customerEmail: booking.customerEmail,
          startTime: booking.startTime
        }
      });
      
      if (!request) {
        console.log(`  ⚠️  NO BOOKING REQUEST FOUND - This was created directly!`);
      } else {
        console.log(`  Request status: ${request.status}`);
      }
      
      console.log('---');
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
})();