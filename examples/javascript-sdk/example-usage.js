/**
 * Meetabl API SDK Usage Examples
 * 
 * This file demonstrates how to use the MeetablAPIClient SDK
 * for common integration scenarios.
 */

const { MeetablAPIClient, APIError } = require('./meetabl-client');

// Initialize the client
const client = new MeetablAPIClient({
  baseURL: 'http://localhost:3000',
  timeout: 10000,
  retries: 3,
  onTokenRefresh: (token, refreshToken) => {
    // Store tokens securely (localStorage, cookies, etc.)
    console.log('Tokens refreshed');
    localStorage.setItem('meetabl_token', token);
    localStorage.setItem('meetabl_refresh_token', refreshToken);
  },
  onError: (error) => {
    console.error('API Error:', error);
  }
});

// Example 1: User Registration and Authentication
async function userAuthenticationExample() {
  console.log('=== User Authentication Example ===');
  
  try {
    // Register a new user
    const registrationData = await client.register(
      'John Doe',
      'john@example.com',
      'securepassword123'
    );
    
    console.log('User registered:', registrationData.user.name);
    console.log('Authenticated:', client.isAuthenticated());
    
    // Or login existing user
    // const loginData = await client.login('john@example.com', 'securepassword123');
    // console.log('User logged in:', loginData.user.name);
    
  } catch (error) {
    if (error instanceof APIError) {
      switch (error.code) {
        case 'VALIDATION_ERROR':
          console.error('Invalid user data:', error.details);
          break;
        case 'USER_EXISTS':
          console.error('User already exists');
          break;
        default:
          console.error('Registration failed:', error.message);
      }
    }
  }
}

// Example 2: User Profile Management
async function userProfileExample() {
  console.log('=== User Profile Example ===');
  
  try {
    // Get current user
    const user = await client.getCurrentUser();
    console.log('Current user:', user.name);
    
    // Update user profile
    const updatedUser = await client.updateUser({
      name: 'John Smith',
      bio: 'Software Developer and Tech Enthusiast',
      timezone: 'America/New_York'
    });
    
    console.log('Profile updated:', updatedUser.name);
    
    // Manage user settings
    const settings = await client.getUserSettings();
    console.log('Current settings:', settings);
    
    const updatedSettings = await client.updateUserSettings({
      notifications: {
        email: true,
        sms: false,
        push: true
      },
      accessibility: {
        screenReader: false,
        highContrast: true,
        fontSize: 'large'
      }
    });
    
    console.log('Settings updated');
    
  } catch (error) {
    console.error('Profile management failed:', error.message);
  }
}

// Example 3: Booking Management
async function bookingManagementExample() {
  console.log('=== Booking Management Example ===');
  
  try {
    // Create a new booking
    const booking = await client.createBooking({
      title: 'Strategy Planning Meeting',
      start: '2024-03-15T10:00:00Z',
      end: '2024-03-15T11:00:00Z',
      attendeeEmail: 'colleague@example.com',
      description: 'Quarterly strategy planning session',
      location: 'Conference Room A',
      reminders: [
        { type: 'email', minutes: 60 },
        { type: 'sms', minutes: 15 }
      ]
    });
    
    console.log('Booking created:', booking.id, booking.title);
    
    // Get all bookings
    const bookings = await client.getBookings({
      startDate: '2024-03-01',
      endDate: '2024-03-31',
      status: 'confirmed'
    });
    
    console.log(`Found ${bookings.length} bookings`);
    
    // Get specific booking
    const specificBooking = await client.getBooking(booking.id);
    console.log('Booking details:', specificBooking.title);
    
    // Cancel booking if needed
    // const cancelledBooking = await client.cancelBooking(booking.id, 'Schedule conflict');
    // console.log('Booking cancelled:', cancelledBooking.status);
    
  } catch (error) {
    console.error('Booking management failed:', error.message);
  }
}

// Example 4: Public Booking (No Authentication)
async function publicBookingExample() {
  console.log('=== Public Booking Example ===');
  
  try {
    // Get public availability for a user
    const availability = await client.getPublicAvailability('johnsmith', {
      date: '2024-03-15',
      duration: 30
    });
    
    console.log('Available slots:', availability.slots?.length || 0);
    
    // Create a public booking
    const publicBooking = await client.createPublicBooking('johnsmith', {
      attendeeName: 'Jane Client',
      attendeeEmail: 'jane@clientcompany.com',
      start: '2024-03-15T14:00:00Z',
      end: '2024-03-15T14:30:00Z',
      message: 'Looking forward to discussing our project requirements.',
      phoneNumber: '+1234567890'
    });
    
    console.log('Public booking created:', publicBooking.id);
    
  } catch (error) {
    console.error('Public booking failed:', error.message);
  }
}

// Example 5: Availability Management
async function availabilityManagementExample() {
  console.log('=== Availability Management Example ===');
  
  try {
    // Get current availability rules
    const rules = await client.getAvailabilityRules();
    console.log(`Current rules: ${rules.length}`);
    
    // Create a new availability rule
    const newRule = await client.createAvailabilityRule({
      type: 'weekly',
      dayOfWeek: 1, // Monday
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'America/New_York',
      isActive: true
    });
    
    console.log('Availability rule created:', newRule.id);
    
    // Update an existing rule
    const updatedRule = await client.updateAvailabilityRule(newRule.id, {
      endTime: '16:00' // End work day an hour earlier
    });
    
    console.log('Rule updated');
    
    // Get available slots for a specific date
    const slots = await client.getAvailableSlots('2024-03-15', 60);
    console.log(`Available 60-minute slots: ${slots.length}`);
    
  } catch (error) {
    console.error('Availability management failed:', error.message);
  }
}

// Example 6: Calendar Integration
async function calendarIntegrationExample() {
  console.log('=== Calendar Integration Example ===');
  
  try {
    // Check current calendar integration status
    const integrations = await client.getCalendarStatus();
    console.log('Google Calendar connected:', integrations.google?.connected || false);
    console.log('Microsoft Calendar connected:', integrations.microsoft?.connected || false);
    
    // Get OAuth URLs for calendar integration
    if (!integrations.google?.connected) {
      const googleAuthUrl = await client.getGoogleAuthUrl();
      console.log('Google OAuth URL:', googleAuthUrl);
      // Redirect user to this URL for authorization
    }
    
    if (!integrations.microsoft?.connected) {
      const microsoftAuthUrl = await client.getMicrosoftAuthUrl();
      console.log('Microsoft OAuth URL:', microsoftAuthUrl);
      // Redirect user to this URL for authorization
    }
    
    // Disconnect a calendar (if needed)
    // await client.disconnectCalendar('google');
    // console.log('Google Calendar disconnected');
    
  } catch (error) {
    console.error('Calendar integration failed:', error.message);
  }
}

// Example 7: Team Management
async function teamManagementExample() {
  console.log('=== Team Management Example ===');
  
  try {
    // Get user's teams
    const teams = await client.getTeams();
    console.log(`User is member of ${teams.length} teams`);
    
    // Create a new team
    const newTeam = await client.createTeam({
      name: 'Marketing Team',
      description: 'Marketing department collaboration space',
      isPublic: false
    });
    
    console.log('Team created:', newTeam.name);
    
    // Add a team member
    const member = await client.addTeamMember(newTeam.id, {
      email: 'teammate@example.com',
      role: 'member'
    });
    
    console.log('Team member added');
    
    // Get team details
    const teamDetails = await client.getTeam(newTeam.id);
    console.log(`Team "${teamDetails.name}" has ${teamDetails.memberCount} members`);
    
  } catch (error) {
    console.error('Team management failed:', error.message);
  }
}

// Example 8: Health Monitoring
async function healthMonitoringExample() {
  console.log('=== Health Monitoring Example ===');
  
  try {
    // Basic health check
    const health = await client.getHealth();
    console.log('API Health:', health.status);
    
    // Detailed health check
    const detailedHealth = await client.getDetailedHealth();
    console.log('Detailed Health:', detailedHealth.status);
    console.log('Database:', detailedHealth.checks?.database?.status);
    console.log('Memory:', detailedHealth.checks?.memory?.status);
    
    // Check specific components
    const dbHealth = await client.getComponentHealth('database');
    console.log('Database Health:', dbHealth.status);
    
  } catch (error) {
    console.error('Health monitoring failed:', error.message);
  }
}

// Example 9: PWA Features
async function pwaFeaturesExample() {
  console.log('=== PWA Features Example ===');
  
  try {
    // Get PWA status
    const pwaStatus = await client.getPWAStatus();
    console.log('PWA enabled:', pwaStatus.pwaEnabled);
    console.log('Service Worker enabled:', pwaStatus.serviceWorkerEnabled);
    
    // Get offline data
    const offlineData = await client.getOfflineData();
    console.log('Offline data retrieved for user:', offlineData.user.name);
    
    // Sync offline data (when coming back online)
    const syncResult = await client.syncOfflineData('bookings', [
      {
        id: 'offline-booking-1',
        title: 'Offline Meeting',
        start: '2024-03-15T10:00:00Z',
        end: '2024-03-15T11:00:00Z',
        attendeeEmail: 'offline@example.com'
      }
    ]);
    
    console.log('Offline data synced:', syncResult.result);
    
  } catch (error) {
    console.error('PWA features failed:', error.message);
  }
}

// Example 10: Error Handling Best Practices
async function errorHandlingExample() {
  console.log('=== Error Handling Example ===');
  
  try {
    // Attempt an operation that might fail
    await client.createBooking({
      // Missing required fields to trigger validation error
      title: '',
      start: 'invalid-date'
    });
    
  } catch (error) {
    if (error instanceof APIError) {
      console.log('API Error Details:');
      console.log('- Status:', error.status);
      console.log('- Code:', error.code);
      console.log('- Message:', error.message);
      
      switch (error.code) {
        case 'VALIDATION_ERROR':
          console.log('Validation errors:', error.details);
          // Handle each validation error
          break;
        case 'AUTH_FAILED':
          console.log('Authentication failed - redirecting to login');
          // Redirect to login page
          break;
        case 'RATE_LIMIT':
          console.log('Rate limit exceeded - retry later');
          // Show rate limit message to user
          break;
        case 'NETWORK_ERROR':
          console.log('Network error - check connection');
          // Show network error message
          break;
        default:
          console.log('Unknown error:', error.message);
      }
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// Example 11: Subscription and Payment
async function subscriptionPaymentExample() {
  console.log('=== Subscription and Payment Example ===');
  
  try {
    // Check subscription status
    const subscription = await client.getSubscriptionStatus();
    console.log('Subscription status:', subscription.status);
    console.log('Plan:', subscription.plan?.name);
    console.log('Next billing:', subscription.currentPeriodEnd);
    
    // Create payment setup intent for card storage
    const setupIntent = await client.createPaymentSetupIntent();
    console.log('Payment setup intent created:', setupIntent.id);
    
    // Note: Frontend would use Stripe.js to handle the payment UI
    console.log('Use this client_secret with Stripe.js:', setupIntent.client_secret);
    
  } catch (error) {
    console.error('Subscription/payment failed:', error.message);
  }
}

// Run all examples
async function runAllExamples() {
  console.log('🚀 Starting Meetabl API SDK Examples\n');
  
  try {
    await userAuthenticationExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await userProfileExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await bookingManagementExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await publicBookingExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await availabilityManagementExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await calendarIntegrationExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await teamManagementExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await healthMonitoringExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await pwaFeaturesExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await subscriptionPaymentExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await errorHandlingExample();
    
  } catch (error) {
    console.error('Example execution failed:', error);
  }
  
  console.log('\n✅ All examples completed!');
}

// Export functions for individual testing
module.exports = {
  client,
  userAuthenticationExample,
  userProfileExample,
  bookingManagementExample,
  publicBookingExample,
  availabilityManagementExample,
  calendarIntegrationExample,
  teamManagementExample,
  healthMonitoringExample,
  pwaFeaturesExample,
  errorHandlingExample,
  subscriptionPaymentExample,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}