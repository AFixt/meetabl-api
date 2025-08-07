#!/usr/bin/env node

/**
 * Debug: Get ALL events from Microsoft calendar without any filtering
 */

require('dotenv').config();
const { CalendarToken } = require('./src/models');
const { Client } = require('@microsoft/microsoft-graph-client');

async function debugCalendar() {
  try {
    const userId = '278cd631-1b71-47e2-a119-c001affa5198';
    
    const token = await CalendarToken.findOne({
      where: { user_id: userId, provider: 'microsoft' }
    });
    
    if (!token) {
      console.log('No Microsoft token found');
      return;
    }
    
    const client = Client.init({
      authProvider: (done) => {
        done(null, token.accessToken);
      }
    });
    
    console.log('='.repeat(80));
    console.log('DEBUGGING MICROSOFT CALENDAR - AUGUST 7, 2025');
    console.log('='.repeat(80));
    
    // Try different API endpoints and approaches
    
    // 1. Get ALL calendars first
    console.log('\n1. ALL CALENDARS:');
    console.log('-'.repeat(40));
    const calendars = await client
      .api('/me/calendars')
      .get();
    
    calendars.value.forEach((cal, idx) => {
      console.log(`${idx + 1}. ${cal.name}`);
      console.log(`   ID: ${cal.id}`);
      console.log(`   Default: ${cal.isDefaultCalendar}`);
      console.log(`   Can View Private: ${cal.canViewPrivateItems}`);
    });
    
    // 2. Try getting events with NO filter at all
    console.log('\n2. FIRST 10 EVENTS (NO FILTER):');
    console.log('-'.repeat(40));
    try {
      const allEvents = await client
        .api('/me/events')
        .top(10)
        .orderby('start/dateTime desc')
        .get();
      
      allEvents.value.forEach((event, idx) => {
        const start = new Date(event.start.dateTime || event.start.date);
        console.log(`${idx + 1}. ${event.subject}`);
        console.log(`   Date: ${start.toLocaleDateString()}`);
        console.log(`   Time: ${start.toLocaleTimeString()}`);
      });
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
    
    // 3. Try calendar view endpoint (better for recurring events)
    console.log('\n3. CALENDAR VIEW FOR AUGUST 7, 2025:');
    console.log('-'.repeat(40));
    try {
      // Use local date boundaries to avoid timezone issues
      const viewStart = '2025-08-07T00:00:00-04:00'; // EDT
      const viewEnd = '2025-08-07T23:59:59-04:00';
      
      const calendarView = await client
        .api('/me/calendarView')
        .query({
          startDateTime: viewStart,
          endDateTime: viewEnd
        })
        .select('subject,start,end,showAs,isAllDay,isCancelled,location,categories,sensitivity,importance')
        .top(100)
        .get();
      
      console.log(`Found ${calendarView.value.length} events in calendar view`);
      
      if (calendarView.value.length > 0) {
        calendarView.value.forEach((event, idx) => {
          const start = new Date(event.start.dateTime || event.start.date);
          const end = new Date(event.end.dateTime || event.end.date);
          const duration = (end - start) / 60000;
          
          console.log(`\n${idx + 1}. ${event.subject}`);
          console.log(`   Start: ${start.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
          console.log(`   End: ${end.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
          console.log(`   Duration: ${duration} minutes`);
          console.log(`   Show As: ${event.showAs}`);
          console.log(`   All Day: ${event.isAllDay}`);
          console.log(`   Cancelled: ${event.isCancelled}`);
          console.log(`   Categories: ${event.categories?.join(', ') || 'None'}`);
        });
      }
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
    
    // 4. Try with different date formats
    console.log('\n4. TRYING DIFFERENT DATE FORMATS:');
    console.log('-'.repeat(40));
    const dateFormats = [
      { start: '2025-08-07T00:00:00Z', end: '2025-08-08T00:00:00Z', label: 'UTC' },
      { start: '2025-08-07T00:00:00-04:00', end: '2025-08-08T00:00:00-04:00', label: 'EDT' },
      { start: '2025-08-06T20:00:00-04:00', end: '2025-08-07T20:00:00-04:00', label: 'EDT day before' },
    ];
    
    for (const format of dateFormats) {
      try {
        const events = await client
          .api('/me/events')
          .filter(`start/dateTime ge '${format.start}' and start/dateTime lt '${format.end}'`)
          .select('subject,start')
          .top(10)
          .get();
        
        console.log(`${format.label}: ${events.value.length} events found`);
        if (events.value.length > 0) {
          console.log(`  First event: ${events.value[0].subject}`);
        }
      } catch (error) {
        console.log(`${format.label}: Error - ${error.message}`);
      }
    }
    
    // 5. Check recurring events specifically
    console.log('\n5. CHECKING FOR RECURRING EVENTS:');
    console.log('-'.repeat(40));
    try {
      const recurringEvents = await client
        .api('/me/events')
        .filter("recurrence ne null")
        .select('subject,start,recurrence')
        .top(20)
        .get();
      
      console.log(`Found ${recurringEvents.value.length} recurring events`);
      recurringEvents.value.forEach((event, idx) => {
        console.log(`${idx + 1}. ${event.subject}`);
        if (event.recurrence?.pattern) {
          console.log(`   Pattern: ${event.recurrence.pattern.type}`);
        }
      });
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
    if (error.response) {
      console.error('Response:', error.response);
    }
  } finally {
    process.exit();
  }
}

debugCalendar();