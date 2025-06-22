/**
 * Performance and Scalability Integration Test
 *
 * Tests API performance under load and validates scalability requirements
 */

const { request, utils, models } = require('../setup');
const app = require('../../../src/app');

describe('Performance and Scalability', () => {
  let testUsers = [];
  let testBookings = [];

  beforeAll(async () => {
    await utils.resetDatabase();
    
    // Create multiple test users for load testing
    for (let i = 0; i < 10; i++) {
      const user = await utils.createTestUser({
        email: `perfuser${i}@example.com`,
        firstName: `PerfUser${i}`,
        lastName: 'Test'
      });
      testUsers.push(user);
    }

    // Create test bookings for each user
    for (const user of testUsers) {
      for (let i = 0; i < 5; i++) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + i + 1);
        futureDate.setHours(10 + i, 0, 0, 0);

        const booking = await utils.createTestBooking(user.id, {
          title: `Performance Test Booking ${i}`,
          startTime: futureDate,
          endTime: new Date(futureDate.getTime() + 60 * 60 * 1000)
        });
        testBookings.push(booking);
      }
    }
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    await utils.cleanup();
  });

  describe('Response time benchmarks', () => {
    test('User authentication should complete within 200ms', async () => {
      const start = Date.now();
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers[0].email,
          password: 'password123'
        })
        .expect(200);

      const duration = Date.now() - start;
      
      expect(response.body.success).toBe(true);
      expect(duration).toBeLessThan(200);
    });

    test('Booking list retrieval should complete within 300ms', async () => {
      const tokens = utils.generateAuthTokens(testUsers[0]);
      const start = Date.now();
      
      const response = await request(app)
        .get('/api/bookings/my')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      const duration = Date.now() - start;
      
      expect(response.body.success).toBe(true);
      expect(duration).toBeLessThan(300);
    });

    test('User profile retrieval should complete within 150ms', async () => {
      const tokens = utils.generateAuthTokens(testUsers[0]);
      const start = Date.now();
      
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      const duration = Date.now() - start;
      
      expect(response.body.success).toBe(true);
      expect(duration).toBeLessThan(150);
    });

    test('Health check should complete within 100ms', async () => {
      const start = Date.now();
      
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      const duration = Date.now() - start;
      
      expect(response.body.status).toBe('healthy');
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Concurrent request handling', () => {
    test('Handles 20 concurrent authentication requests', async () => {
      const promises = Array.from({ length: 20 }, (_, i) => {
        const userIndex = i % testUsers.length;
        return request(app)
          .post('/api/auth/login')
          .send({
            email: testUsers[userIndex].email,
            password: 'password123'
          });
      });

      const start = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(2000);
    }, 10000);

    test('Handles 30 concurrent booking retrievals', async () => {
      const promises = Array.from({ length: 30 }, (_, i) => {
        const userIndex = i % testUsers.length;
        const tokens = utils.generateAuthTokens(testUsers[userIndex]);
        
        return request(app)
          .get('/api/bookings/my')
          .set('Authorization', `Bearer ${tokens.accessToken}`);
      });

      const start = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(3000);
    }, 15000);

    test('Handles mixed concurrent operations', async () => {
      const operations = [
        // Authentication requests
        ...Array.from({ length: 10 }, (_, i) =>
          request(app)
            .post('/api/auth/login')
            .send({
              email: testUsers[i % testUsers.length].email,
              password: 'password123'
            })
        ),
        // Profile requests
        ...Array.from({ length: 10 }, (_, i) => {
          const tokens = utils.generateAuthTokens(testUsers[i % testUsers.length]);
          return request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${tokens.accessToken}`);
        }),
        // Booking list requests
        ...Array.from({ length: 10 }, (_, i) => {
          const tokens = utils.generateAuthTokens(testUsers[i % testUsers.length]);
          return request(app)
            .get('/api/bookings/my')
            .set('Authorization', `Bearer ${tokens.accessToken}`);
        })
      ];

      const start = Date.now();
      const responses = await Promise.all(operations);
      const duration = Date.now() - start;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000);
    }, 20000);
  });

  describe('Database query performance', () => {
    test('Large booking list retrieval with pagination', async () => {
      const tokens = utils.generateAuthTokens(testUsers[0]);
      
      const start = Date.now();
      const response = await request(app)
        .get('/api/bookings/my?limit=100&offset=0')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);
      const duration = Date.now() - start;

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(duration).toBeLessThan(500);
    });

    test('Complex availability query performance', async () => {
      const tokens = utils.generateAuthTokens(testUsers[0]);
      
      // Get availability for the next 30 days
      const promises = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i + 1);
        const dateStr = date.toISOString().split('T')[0];
        
        return request(app)
          .get(`/api/availability/slots?date=${dateStr}`)
          .set('Authorization', `Bearer ${tokens.accessToken}`);
      });

      const start = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(3000);
    }, 15000);

    test('Search functionality performance', async () => {
      const tokens = utils.generateAuthTokens(testUsers[0]);
      
      const searchQueries = [
        'Performance',
        'Test',
        'Booking',
        'Meeting',
        'Demo'
      ];

      const promises = searchQueries.map(query =>
        request(app)
          .get(`/api/bookings/my?search=${encodeURIComponent(query)}`)
          .set('Authorization', `Bearer ${tokens.accessToken}`)
      );

      const start = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Memory usage and resource cleanup', () => {
    test('Memory usage remains stable during operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform multiple operations
      for (let i = 0; i < 50; i++) {
        const tokens = utils.generateAuthTokens(testUsers[i % testUsers.length]);
        
        await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${tokens.accessToken}`)
          .expect(200);
        
        await request(app)
          .get('/api/bookings/my')
          .set('Authorization', `Bearer ${tokens.accessToken}`)
          .expect(200);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50);
    }, 30000);

    test('Database connections are properly managed', async () => {
      const { sequelize } = require('../../../src/config/database');
      const { getPoolStats } = require('../../../src/config/database');
      
      const initialStats = getPoolStats();
      
      // Perform database-intensive operations
      const promises = Array.from({ length: 20 }, async (_, i) => {
        const tokens = utils.generateAuthTokens(testUsers[i % testUsers.length]);
        
        return request(app)
          .get('/api/bookings/my')
          .set('Authorization', `Bearer ${tokens.accessToken}`);
      });

      await Promise.all(promises);
      
      // Wait for connections to be returned to pool
      await utils.waitFor(1000);
      
      const finalStats = getPoolStats();
      
      // Available connections should be close to the initial number
      expect(finalStats.available).toBeGreaterThanOrEqual(initialStats.available - 2);
      expect(finalStats.using).toBeLessThanOrEqual(2);
    }, 15000);
  });

  describe('Error handling under load', () => {
    test('Maintains error handling quality under concurrent load', async () => {
      // Mix of valid and invalid requests
      const operations = [
        // Valid requests
        ...Array.from({ length: 10 }, (_, i) => {
          const tokens = utils.generateAuthTokens(testUsers[i % testUsers.length]);
          return request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${tokens.accessToken}`);
        }),
        // Invalid requests
        ...Array.from({ length: 5 }, () =>
          request(app)
            .get('/api/users/me')
            .set('Authorization', 'Bearer invalid-token')
        ),
        // Non-existent resources
        ...Array.from({ length: 5 }, (_, i) => {
          const tokens = utils.generateAuthTokens(testUsers[i % testUsers.length]);
          return request(app)
            .get('/api/bookings/my/99999')
            .set('Authorization', `Bearer ${tokens.accessToken}`);
        })
      ];

      const responses = await Promise.all(operations);
      
      // Check that errors are properly formatted
      responses.forEach(response => {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('message');
        expect(typeof response.body.message).toBe('string');
      });

      // Count successful vs error responses
      const successCount = responses.filter(r => r.status === 200).length;
      const errorCount = responses.filter(r => r.status >= 400).length;
      
      expect(successCount).toBe(10); // Valid requests
      expect(errorCount).toBe(10);   // Invalid requests
    }, 10000);
  });

  describe('API rate limiting under load', () => {
    test('Rate limiting functions correctly under concurrent requests', async () => {
      // Make many authentication requests rapidly
      const promises = Array.from({ length: 50 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should hit rate limits
      const rateLimited = responses.filter(r => r.status === 429);
      const tooManyRequests = rateLimited.length;
      
      // Should have some rate limiting active
      expect(tooManyRequests).toBeGreaterThan(0);
      
      // Rate limited responses should have proper format
      rateLimited.forEach(response => {
        expect(response.body.message).toContain('rate limit');
      });
    }, 15000);
  });
});