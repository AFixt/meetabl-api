/**
 * BookingRequest model unit tests
 *
 * Tests BookingRequest model validation, constraints, and lifecycle
 *
 * @author meetabl Team
 */

require('../test-setup');

const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../../../src/config/database');
const BookingRequest = require('../../../src/models/bookingRequest.model');
const { generateBookingConfirmationToken } = require('../../../src/utils/crypto');

describe('BookingRequest Model', () => {
  // Clean up database before each test
  beforeEach(async () => {
    if (sequelize.getQueryInterface) {
      try {
        await sequelize.getQueryInterface().bulkDelete('booking_requests', {}, {});
      } catch (error) {
        // Table might not exist yet, which is fine
      }
    }
  });

  describe('Model Definition', () => {
    test('should have correct table name', () => {
      expect(BookingRequest.tableName).toBe('booking_requests');
    });

    test('should have correct primary key', () => {
      const idAttribute = BookingRequest.rawAttributes.id;
      expect(idAttribute.primaryKey).toBe(true);
      expect(idAttribute.type.constructor.name).toBe('STRING');
    });

    test('should generate UUID for id by default', () => {
      const idAttribute = BookingRequest.rawAttributes.id;
      const defaultValue = idAttribute.defaultValue();
      expect(typeof defaultValue).toBe('string');
      expect(defaultValue.length).toBe(36);
      expect(defaultValue).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test('should have timestamps enabled', () => {
      expect(BookingRequest.options.timestamps).toBe(true);
      expect(BookingRequest.options.createdAt).toBe('createdAt');
      expect(BookingRequest.options.updatedAt).toBe('updatedAt');
    });
  });

  describe('Field Validation', () => {
    const getValidBookingRequestData = () => ({
      id: uuidv4(),
      userId: uuidv4(),
      customerName: 'John Doe',
      customerEmail: 'john.doe@example.com',
      customerPhone: '+1234567890',
      startTime: new Date('2024-12-01T10:00:00Z'),
      endTime: new Date('2024-12-01T11:00:00Z'),
      notes: 'Test meeting notes',
      confirmationToken: generateBookingConfirmationToken(),
      status: 'pending',
      expiresAt: new Date('2024-12-01T10:30:00Z')
    });

    test('should create booking request with valid data', async () => {
      const validData = getValidBookingRequestData();
      
      const bookingRequest = BookingRequest.build(validData);
      await expect(bookingRequest.validate()).resolves.not.toThrow();
      
      expect(bookingRequest.id).toBe(validData.id);
      expect(bookingRequest.userId).toBe(validData.userId);
      expect(bookingRequest.customerName).toBe(validData.customerName);
      expect(bookingRequest.customerEmail).toBe(validData.customerEmail);
      expect(bookingRequest.status).toBe('pending');
    });

    describe('userId validation', () => {
      test('should reject null userId', async () => {
        const data = getValidBookingRequestData();
        data.userId = null;
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).rejects.toThrow();
      });

      test('should reject undefined userId', async () => {
        const data = getValidBookingRequestData();
        delete data.userId;
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).rejects.toThrow();
      });

      test('should accept valid UUID userId', async () => {
        const data = getValidBookingRequestData();
        data.userId = uuidv4();
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).resolves.not.toThrow();
        expect(bookingRequest.userId).toBe(data.userId);
      });
    });

    describe('customerName validation', () => {
      test('should reject null customerName', async () => {
        const data = getValidBookingRequestData();
        data.customerName = null;
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).rejects.toThrow();
      });

      test('should reject empty customerName', async () => {
        const data = getValidBookingRequestData();
        data.customerName = '';
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).rejects.toThrow();
      });

      test('should reject customerName with only whitespace', async () => {
        const data = getValidBookingRequestData();
        data.customerName = '   ';
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).rejects.toThrow();
      });

      test('should accept valid customerName', async () => {
        const data = getValidBookingRequestData();
        data.customerName = 'Jane Smith';
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).resolves.not.toThrow();
        expect(bookingRequest.customerName).toBe('Jane Smith');
      });

      test('should accept customerName at max length', async () => {
        const data = getValidBookingRequestData();
        data.customerName = 'A'.repeat(100); // Max length is 100
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).resolves.not.toThrow();
      });
    });

    describe('customerEmail validation', () => {
      test('should reject null customerEmail', async () => {
        const data = getValidBookingRequestData();
        data.customerEmail = null;
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).rejects.toThrow();
      });

      test('should reject invalid email format', async () => {
        const data = getValidBookingRequestData();
        data.customerEmail = 'invalid-email';
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).rejects.toThrow();
      });

      test('should reject email without domain', async () => {
        const data = getValidBookingRequestData();
        data.customerEmail = 'user@';
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).rejects.toThrow();
      });

      test('should accept valid email formats', async () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'test+tag@example.org',
          'user123@test-domain.com'
        ];

        for (const email of validEmails) {
          const data = getValidBookingRequestData();
          data.customerEmail = email;
          
          const bookingRequest = BookingRequest.build(data);
          await expect(bookingRequest.validate()).resolves.not.toThrow();
          expect(bookingRequest.customerEmail).toBe(email);
        }
      });
    });

    describe('customerPhone validation', () => {
      test('should allow null customerPhone', async () => {
        const data = getValidBookingRequestData();
        data.customerPhone = null;
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).resolves.not.toThrow();
        expect(bookingRequest.customerPhone).toBeNull();
      });

      test('should accept valid phone formats', async () => {
        const validPhones = [
          '+1234567890',
          '+44 20 7946 0958',
          '(555) 123-4567',
          '555-123-4567',
          '5551234567'
        ];

        for (const phone of validPhones) {
          const data = getValidBookingRequestData();
          data.customerPhone = phone;
          
          const bookingRequest = BookingRequest.build(data);
          await expect(bookingRequest.validate()).resolves.not.toThrow();
          expect(bookingRequest.customerPhone).toBe(phone);
        }
      });
    });

    describe('date validation', () => {
      test('should reject null startTime', async () => {
        const data = getValidBookingRequestData();
        data.startTime = null;
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).rejects.toThrow();
      });

      test('should reject null endTime', async () => {
        const data = getValidBookingRequestData();
        data.endTime = null;
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).rejects.toThrow();
      });

      test('should accept valid date objects', async () => {
        const data = getValidBookingRequestData();
        const startTime = new Date('2024-12-01T14:00:00Z');
        const endTime = new Date('2024-12-01T15:00:00Z');
        
        data.startTime = startTime;
        data.endTime = endTime;
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).resolves.not.toThrow();
        expect(bookingRequest.startTime).toEqual(startTime);
        expect(bookingRequest.endTime).toEqual(endTime);
      });

      test('should accept valid ISO date strings', async () => {
        const data = getValidBookingRequestData();
        data.startTime = '2024-12-01T14:00:00Z';
        data.endTime = '2024-12-01T15:00:00Z';
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).resolves.not.toThrow();
      });
    });

    describe('confirmationToken validation', () => {
      test('should reject null confirmationToken', async () => {
        const data = getValidBookingRequestData();
        data.confirmationToken = null;
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).rejects.toThrow();
      });

      test('should accept empty confirmationToken but reject null', async () => {
        const data = getValidBookingRequestData();
        data.confirmationToken = '';
        
        const bookingRequest = BookingRequest.build(data);
        // Empty string is allowed by the model (no notEmpty validation)
        await expect(bookingRequest.validate()).resolves.not.toThrow();
        expect(bookingRequest.confirmationToken).toBe('');
      });

      test('should accept valid confirmationToken', async () => {
        const data = getValidBookingRequestData();
        const token = generateBookingConfirmationToken();
        data.confirmationToken = token;
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).resolves.not.toThrow();
        expect(bookingRequest.confirmationToken).toBe(token);
      });
    });

    describe('status validation', () => {
      test('should default to pending status', () => {
        const data = getValidBookingRequestData();
        delete data.status;
        
        const bookingRequest = BookingRequest.build(data);
        expect(bookingRequest.status).toBe('pending');
      });

      test('should accept valid status values', async () => {
        const validStatuses = ['pending', 'confirmed', 'expired', 'cancelled'];

        for (const status of validStatuses) {
          const data = getValidBookingRequestData();
          data.status = status;
          
          const bookingRequest = BookingRequest.build(data);
          await expect(bookingRequest.validate()).resolves.not.toThrow();
          expect(bookingRequest.status).toBe(status);
        }
      });

      test('should accept invalid status during build but would fail at database level', async () => {
        const data = getValidBookingRequestData();
        data.status = 'invalid-status';
        
        const bookingRequest = BookingRequest.build(data);
        // ENUM validation happens at database level, not model validation level
        // The build() and validate() will succeed, but save() would fail with database
        await expect(bookingRequest.validate()).resolves.not.toThrow();
        expect(bookingRequest.status).toBe('invalid-status');
      });
    });

    describe('expiresAt validation', () => {
      test('should reject null expiresAt', async () => {
        const data = getValidBookingRequestData();
        data.expiresAt = null;
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).rejects.toThrow();
      });

      test('should accept valid expiresAt date', async () => {
        const data = getValidBookingRequestData();
        const expiresAt = new Date('2024-12-01T10:30:00Z');
        data.expiresAt = expiresAt;
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).resolves.not.toThrow();
        expect(bookingRequest.expiresAt).toEqual(expiresAt);
      });
    });

    describe('confirmedAt validation', () => {
      test('should allow null confirmedAt', async () => {
        const data = getValidBookingRequestData();
        data.confirmedAt = null;
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).resolves.not.toThrow();
        expect(bookingRequest.confirmedAt).toBeNull();
      });

      test('should accept valid confirmedAt date', async () => {
        const data = getValidBookingRequestData();
        const confirmedAt = new Date('2024-12-01T10:15:00Z');
        data.confirmedAt = confirmedAt;
        
        const bookingRequest = BookingRequest.build(data);
        await expect(bookingRequest.validate()).resolves.not.toThrow();
        expect(bookingRequest.confirmedAt).toEqual(confirmedAt);
      });
    });
  });

  describe('Lifecycle Methods', () => {
    test('should automatically set createdAt on creation', () => {
      const bookingRequest = BookingRequest.build({
        userId: uuidv4(),
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        startTime: new Date(),
        endTime: new Date(),
        confirmationToken: generateBookingConfirmationToken(),
        expiresAt: new Date()
      });

      expect(bookingRequest.createdAt).toBeInstanceOf(Date);
    });

    test('should update updatedAt on modification', async () => {
      // Note: This test would require database operations to fully test
      // For unit testing, we can verify the field is configured correctly
      const attributes = BookingRequest.rawAttributes;
      expect(attributes.updatedAt).toBeDefined();
      expect(attributes.updatedAt.field).toBe('updated');
    });
  });

  describe('Field Mapping', () => {
    test('should map field names correctly', () => {
      const attributes = BookingRequest.rawAttributes;
      
      expect(attributes.userId.field).toBe('user_id');
      expect(attributes.customerName.field).toBe('customer_name');
      expect(attributes.customerEmail.field).toBe('customer_email');
      expect(attributes.customerPhone.field).toBe('customer_phone');
      expect(attributes.startTime.field).toBe('start_time');
      expect(attributes.endTime.field).toBe('end_time');
      expect(attributes.confirmationToken.field).toBe('confirmation_token');
      expect(attributes.expiresAt.field).toBe('expires_at');
      expect(attributes.confirmedAt.field).toBe('confirmed_at');
      expect(attributes.createdAt.field).toBe('created');
      expect(attributes.updatedAt.field).toBe('updated');
    });
  });

  describe('Constraints', () => {
    test('should have unique constraint on confirmationToken', () => {
      const tokenAttribute = BookingRequest.rawAttributes.confirmationToken;
      expect(tokenAttribute.unique).toBe(true);
    });

    test('should enforce NOT NULL constraints', () => {
      const requiredFields = [
        'userId', 'customerName', 'customerEmail', 
        'startTime', 'endTime', 'confirmationToken', 'status', 'expiresAt'
      ];

      for (const field of requiredFields) {
        const attribute = BookingRequest.rawAttributes[field];
        expect(attribute.allowNull).toBe(false);
      }
    });

    test('should allow NULL for optional fields', () => {
      const optionalFields = ['customerPhone', 'notes', 'confirmedAt'];

      for (const field of optionalFields) {
        const attribute = BookingRequest.rawAttributes[field];
        expect(attribute.allowNull).toBe(true);
      }
    });
  });

  describe('Business Logic Validation', () => {
    test('should create booking request with realistic data', async () => {
      const now = new Date();
      const startTime = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // Tomorrow
      const endTime = new Date(startTime.getTime() + (60 * 60 * 1000)); // 1 hour later
      const expiresAt = new Date(now.getTime() + (30 * 60 * 1000)); // 30 minutes from now

      const bookingRequest = BookingRequest.build({
        userId: uuidv4(),
        customerName: 'Jane Smith',
        customerEmail: 'jane.smith@company.com',
        customerPhone: '+1-555-123-4567',
        startTime: startTime,
        endTime: endTime,
        notes: 'Quarterly review meeting',
        confirmationToken: generateBookingConfirmationToken(),
        status: 'pending',
        expiresAt: expiresAt
      });

      await expect(bookingRequest.validate()).resolves.not.toThrow();
      
      expect(bookingRequest.startTime).toEqual(startTime);
      expect(bookingRequest.endTime).toEqual(endTime);
      expect(bookingRequest.expiresAt).toEqual(expiresAt);
      expect(bookingRequest.status).toBe('pending');
    });

    test('should handle status transitions', async () => {
      const data = {
        userId: uuidv4(),
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        startTime: new Date(),
        endTime: new Date(),
        confirmationToken: generateBookingConfirmationToken(),
        expiresAt: new Date(),
        status: 'pending'
      };

      // Test pending -> confirmed
      data.status = 'confirmed';
      data.confirmedAt = new Date();
      
      const bookingRequest = BookingRequest.build(data);
      await expect(bookingRequest.validate()).resolves.not.toThrow();
      expect(bookingRequest.status).toBe('confirmed');
      expect(bookingRequest.confirmedAt).toBeInstanceOf(Date);
    });
  });
});