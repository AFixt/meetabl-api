/**
 * Booking Model Tests
 * 
 * Tests for the Booking model definition and methods
 * 
 * @author meetabl Team
 */

// Mock sequelize
const mockSequelize = {
  define: jest.fn(() => ({
    associate: jest.fn(),
    addHook: jest.fn(),
    beforeCreate: jest.fn(),
    beforeUpdate: jest.fn()
  })),
  DataTypes: {
    INTEGER: 'INTEGER',
    STRING: 'STRING',
    TEXT: 'TEXT',
    DATE: 'DATE',
    ENUM: jest.fn((values) => ({ type: 'ENUM', values })),
    DECIMAL: 'DECIMAL',
    BOOLEAN: 'BOOLEAN'
  }
};

// Mock the sequelize config
jest.mock('../../../src/config/database', () => ({
  sequelize: mockSequelize
}));

const defineBooking = require('../../../src/models/booking.model');

describe('Booking Model', () => {
  let mockModel;

  beforeEach(() => {
    jest.clearAllMocks();
    mockModel = {
      associate: jest.fn(),
      addHook: jest.fn(),
      belongsTo: jest.fn(),
      hasMany: jest.fn()
    };
    mockSequelize.define.mockReturnValue(mockModel);
  });

  test('should define Booking model with correct attributes', () => {
    const Booking = defineBooking(mockSequelize, mockSequelize.DataTypes);

    expect(mockSequelize.define).toHaveBeenCalledWith('Booking', expect.objectContaining({
      id: expect.objectContaining({
        type: 'INTEGER',
        primaryKey: true,
        autoIncrement: true
      }),
      hostId: expect.objectContaining({
        type: 'INTEGER',
        allowNull: false
      }),
      attendeeId: expect.objectContaining({
        type: 'INTEGER',
        allowNull: true
      }),
      attendeeName: expect.objectContaining({
        type: 'STRING',
        allowNull: false
      }),
      attendeeEmail: expect.objectContaining({
        type: 'STRING',
        allowNull: false
      }),
      attendeePhone: expect.objectContaining({
        type: 'STRING',
        allowNull: true
      }),
      title: expect.objectContaining({
        type: 'STRING',
        allowNull: false
      }),
      description: expect.objectContaining({
        type: 'TEXT',
        allowNull: true
      }),
      scheduledAt: expect.objectContaining({
        type: 'DATE',
        allowNull: false
      }),
      duration: expect.objectContaining({
        type: 'INTEGER',
        allowNull: false,
        defaultValue: 30
      }),
      status: expect.objectContaining({
        allowNull: false,
        defaultValue: 'scheduled'
      }),
      location: expect.objectContaining({
        type: 'STRING',
        allowNull: true
      }),
      meetingUrl: expect.objectContaining({
        type: 'STRING',
        allowNull: true
      }),
      price: expect.objectContaining({
        type: 'DECIMAL',
        allowNull: true
      }),
      paymentStatus: expect.objectContaining({
        allowNull: true,
        defaultValue: null
      }),
      notes: expect.objectContaining({
        type: 'TEXT',
        allowNull: true
      }),
      cancelledAt: expect.objectContaining({
        type: 'DATE',
        allowNull: true
      }),
      cancelReason: expect.objectContaining({
        type: 'TEXT',
        allowNull: true
      }),
      reminderSent: expect.objectContaining({
        type: 'BOOLEAN',
        defaultValue: false
      }),
      confirmed: expect.objectContaining({
        type: 'BOOLEAN',
        defaultValue: false
      })
    }), expect.objectContaining({
      tableName: 'bookings',
      timestamps: true,
      createdAt: 'created',
      updatedAt: 'updated'
    }));

    expect(Booking).toBe(mockModel);
  });

  test('should set up model associations', () => {
    const Booking = defineBooking(mockSequelize, mockSequelize.DataTypes);
    
    // Mock models for associations
    const mockModels = {
      User: { name: 'User' },
      Notification: { name: 'Notification' },
      AuditLog: { name: 'AuditLog' }
    };

    // Call the associate function
    if (Booking.associate) {
      Booking.associate(mockModels);
    }

    // Verify associations were set up
    expect(mockModel.belongsTo).toHaveBeenCalledWith(mockModels.User, {
      as: 'host',
      foreignKey: 'hostId'
    });
    
    expect(mockModel.belongsTo).toHaveBeenCalledWith(mockModels.User, {
      as: 'attendee',
      foreignKey: 'attendeeId'
    });

    expect(mockModel.hasMany).toHaveBeenCalledWith(mockModels.Notification, {
      foreignKey: 'relatedId',
      scope: { relatedType: 'booking' }
    });

    expect(mockModel.hasMany).toHaveBeenCalledWith(mockModels.AuditLog, {
      foreignKey: 'relatedId',
      scope: { relatedType: 'booking' }
    });
  });

  test('should validate status enum values', () => {
    defineBooking(mockSequelize, mockSequelize.DataTypes);

    const statusCall = mockSequelize.DataTypes.ENUM.mock.calls.find(call => 
      call[0] && call[0].includes('scheduled')
    );
    
    expect(statusCall).toBeDefined();
    expect(statusCall[0]).toEqual(['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show']);
  });

  test('should validate payment status enum values', () => {
    defineBooking(mockSequelize, mockSequelize.DataTypes);

    const paymentStatusCall = mockSequelize.DataTypes.ENUM.mock.calls.find(call => 
      call[0] && call[0].includes('pending')
    );
    
    expect(paymentStatusCall).toBeDefined();
    expect(paymentStatusCall[0]).toEqual(['pending', 'paid', 'failed', 'refunded']);
  });

  test('should have correct table configuration', () => {
    defineBooking(mockSequelize, mockSequelize.DataTypes);

    const defineCall = mockSequelize.define.mock.calls[0];
    const options = defineCall[2];

    expect(options.tableName).toBe('bookings');
    expect(options.timestamps).toBe(true);
    expect(options.createdAt).toBe('created');
    expect(options.updatedAt).toBe('updated');
  });

  test('should validate email format in attendeeEmail', () => {
    defineBooking(mockSequelize, mockSequelize.DataTypes);

    const defineCall = mockSequelize.define.mock.calls[0];
    const attributes = defineCall[1];
    
    expect(attributes.attendeeEmail.validate).toBeDefined();
    expect(attributes.attendeeEmail.validate.isEmail).toBeDefined();
  });

  test('should validate duration is positive', () => {
    defineBooking(mockSequelize, mockSequelize.DataTypes);

    const defineCall = mockSequelize.define.mock.calls[0];
    const attributes = defineCall[1];
    
    expect(attributes.duration.validate).toBeDefined();
    expect(attributes.duration.validate.min).toBeDefined();
  });
});