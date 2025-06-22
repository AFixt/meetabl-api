#!/usr/bin/env node

/**
 * Final verification test for meetabl local setup
 * Tests API endpoints and UI build process
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

console.log('🔬 Final verification of meetabl local setup...\n');

async function runTest() {
  try {
    // 1. Test API startup
    console.log('1. ✅ Testing API startup...');
    const apiProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, 'meetabl-api'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for API to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 2. Test API endpoints
    console.log('2. ✅ Testing API endpoints...');
    
    // Test root endpoint
    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/',
        method: 'GET'
      }, (res) => {
        if (res.statusCode === 200) {
          console.log('   ✅ Root endpoint working');
          resolve();
        } else {
          reject(new Error(`Root endpoint failed: ${res.statusCode}`));
        }
      });
      req.on('error', reject);
      req.setTimeout(5000, () => reject(new Error('Timeout')));
      req.end();
    });

    // Test authentication
    const loginData = JSON.stringify({
      email: 'demo@meetabl.com',
      password: 'password123'
    });

    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(loginData)
        }
      }, (res) => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('   ✅ Authentication working');
          resolve();
        } else {
          reject(new Error(`Auth failed: ${res.statusCode}`));
        }
      });
      req.on('error', reject);
      req.setTimeout(5000, () => reject(new Error('Timeout')));
      req.write(loginData);
      req.end();
    });

    // Kill API process
    apiProcess.kill('SIGTERM');
    
    console.log('3. ✅ Testing UI build process...');
    
    // Test UI build
    const uiBuildProcess = spawn('npm', ['run', 'build'], {
      cwd: path.join(__dirname, 'meetabl-ui'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    await new Promise((resolve, reject) => {
      uiBuildProcess.on('close', (code) => {
        if (code === 0) {
          console.log('   ✅ UI build successful');
          resolve();
        } else {
          reject(new Error(`UI build failed with code ${code}`));
        }
      });
      
      uiBuildProcess.on('error', reject);
      
      // Timeout after 60 seconds
      setTimeout(() => {
        uiBuildProcess.kill('SIGTERM');
        reject(new Error('UI build timeout'));
      }, 60000);
    });

    console.log('\n🎉 ALL TESTS PASSED!\n');
    console.log('✅ API server starts and responds correctly');
    console.log('✅ Database connection working');
    console.log('✅ Authentication system working');
    console.log('✅ Demo user login successful');
    console.log('✅ UI builds without errors');
    console.log('\n📋 Your meetabl application is ready for local development!\n');
    console.log('🚀 To start the full application:');
    console.log('   ./start-local.sh\n');
    console.log('🌐 Then visit: http://localhost:5173');
    console.log('👤 Login with: demo@meetabl.com / password123\n');

  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

runTest().catch(console.error);