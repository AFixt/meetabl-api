/**
 * Script to fix incorrect email addresses in calendar tokens
 * 
 * Run with: node scripts/fix-calendar-emails.js
 */

const { CalendarToken } = require('../src/models');
const calendarService = require('../src/services/calendar.service');
const logger = require('../src/config/logger');

async function fixCalendarEmails() {
  try {
    console.log('Starting to fix calendar email addresses...');
    
    // Find all calendar tokens
    const tokens = await CalendarToken.findAll();
    
    console.log(`Found ${tokens.length} calendar tokens to check`);
    
    for (const token of tokens) {
      try {
        console.log(`\nChecking token for user ${token.userId}, provider: ${token.provider}, current email: ${token.email}`);
        
        // Skip if token has expired
        if (new Date(token.expiresAt) < new Date()) {
          console.log('  Token has expired, skipping...');
          continue;
        }
        
        let correctEmail = null;
        
        // Fetch the correct email based on provider
        if (token.provider === 'google') {
          try {
            correctEmail = await calendarService.getGoogleUserEmail(token.userId, token.accessToken);
          } catch (error) {
            console.log(`  Failed to fetch Google email: ${error.message}`);
            continue;
          }
        } else if (token.provider === 'microsoft') {
          try {
            correctEmail = await calendarService.getMicrosoftUserEmail(token.userId, token.accessToken);
          } catch (error) {
            console.log(`  Failed to fetch Microsoft email: ${error.message}`);
            continue;
          }
        }
        
        if (correctEmail && correctEmail !== token.email) {
          console.log(`  Updating email from "${token.email}" to "${correctEmail}"`);
          token.email = correctEmail;
          await token.save();
          console.log('  ✓ Email updated successfully');
        } else if (correctEmail) {
          console.log(`  Email is already correct: ${correctEmail}`);
        }
        
      } catch (error) {
        console.error(`  Error processing token ${token.id}:`, error.message);
      }
    }
    
    console.log('\n✅ Finished fixing calendar emails');
    process.exit(0);
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
fixCalendarEmails();