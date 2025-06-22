#!/usr/bin/env node

/**
 * Test script for local meetabl setup
 * Verifies that the API can start and handle basic requests
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

// Configuration
const API_PORT = 3001;
const TIMEOUT = 30000; // 30 seconds

console.log('🧪 Testing meetabl local setup...\n');

// Start API server
console.log('1. Starting API server...');
const apiProcess = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'meetabl-api'),
  stdio: ['pipe', 'pipe', 'pipe']
});

let apiOutput = '';
apiProcess.stdout.on('data', (data) => {
  apiOutput += data.toString();
});

apiProcess.stderr.on('data', (data) => {
  apiOutput += data.toString();
});

// Test API health
function testAPI() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: API_PORT,
      path: '/',
      method: 'GET'
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ status: res.statusCode, body });
        } else {
          reject(new Error(`API health check failed: ${res.statusCode} ${body}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('API health check timeout'));
    });
    req.end();
  });
}

// Wait for API to start and test
setTimeout(async () => {
  try {
    console.log('2. Testing API root endpoint...');
    
    // Try health check multiple times
    let attempts = 0;
    const maxAttempts = 6;
    
    while (attempts < maxAttempts) {
      try {
        await testAPI();
        console.log('✅ API root endpoint responding');
        break;
      } catch (error) {
        attempts++;
        if (attempts === maxAttempts) {
          throw error;
        }
        console.log(`   Attempt ${attempts}/${maxAttempts} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('3. Testing auth endpoint...');
    
    // Test login endpoint
    const loginData = JSON.stringify({
      email: 'demo@meetabl.com',
      password: 'password123'
    });

    const loginPromise = new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: API_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(loginData)
        }
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } else {
            reject(new Error(`Login failed: ${res.statusCode} ${body}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Login request timeout'));
      });
      req.write(loginData);
      req.end();
    });

    const loginResult = await loginPromise;
    console.log('✅ Demo user login successful');
    console.log(`   User: ${loginResult.body.user?.name || 'Demo User'}`);

    console.log('\n🎉 All tests passed! The local setup is working correctly.\n');
    
    console.log('📋 Next steps:');
    console.log('   1. Use the start-local.sh script to run both API and UI');
    console.log('   2. Visit http://localhost:5173 to access the application');
    console.log('   3. Login with demo@meetabl.com / password123');
    console.log('\n   Run: ./start-local.sh\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n📋 Debug information:');
    console.log('API output:');
    console.log(apiOutput);
  } finally {
    // Clean up
    apiProcess.kill('SIGTERM');
    process.exit(0);
  }
}, 5000);

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  apiProcess.kill('SIGTERM');
  process.exit(0);
});

// Handle timeout
setTimeout(() => {
  console.error('❌ Test timeout after 30 seconds');
  apiProcess.kill('SIGTERM');
  process.exit(1);
}, TIMEOUT);