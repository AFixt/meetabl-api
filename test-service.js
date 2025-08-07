#!/usr/bin/env node

require('dotenv').config();
const calendarService = require('./src/services/calendar.service');

async function testService() {
  try {
    const userId = '278cd631-1b71-47e2-a119-c001affa5198';
    
    // Test August 7, 2025
    const startTime = new Date('2025-08-07T00:00:00Z');
    const endTime = new Date('2025-08-07T23:59:59Z');
    
    console.log('Testing calendar service for August 7, 2025...\n');
    
    const busyTimes = await calendarService.getAllBusyTimes(userId, startTime, endTime);
    
    console.log(`Found ${busyTimes.length} busy times:`);
    busyTimes.forEach((bt, idx) => {
      const start = new Date(bt.start);
      const end = new Date(bt.end);
      const duration = (end - start) / 60000;
      
      console.log(`${idx + 1}. ${start.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York'
      })} - ${end.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York'
      })} (${duration} minutes)`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

testService();