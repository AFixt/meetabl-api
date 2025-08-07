#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testEmailVerification() {
  try {
    // Register a new user
    console.log('1. Registering new user...');
    const registerResponse = await axios.post(`${API_URL}/auth/register`, {
      email: 'test@example.com',
      password: 'Test123!@#',
      firstName: 'Test',
      lastName: 'User',
      timezone: 'America/New_York'
    });
    
    console.log('Registration successful:', {
      message: registerResponse.data.message,
      emailSent: registerResponse.data.data?.emailSent
    });
    
    // Get the verification token from the database (for testing)
    const { User } = require('../src/models');
    const user = await User.findOne({ where: { email: 'test@example.com' } });
    
    if (!user || !user.email_verification_token) {
      console.error('User not found or no verification token');
      return;
    }
    
    // Extract the token (it's stored as a hash, so we need the original from the email)
    // For testing, we'll need to look at the email logs or database
    console.log('\n2. User created with verification token');
    console.log('Email verification required:', !user.email_verified);
    console.log('Token expires at:', user.email_verification_expires);
    
    console.log('\n✅ Email verification setup successful!');
    console.log('Check your email for the verification link');
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
  
  process.exit(0);
}

testEmailVerification();