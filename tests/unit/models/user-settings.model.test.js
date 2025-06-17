/**
 * UserSettings Model Tests
 * 
 * Tests for the UserSettings model definition and methods
 * 
 * @author meetabl Team
 */

// Mock sequelize
const mockSequelize = {
  define: jest.fn(() => ({
    associate: jest.fn(),
    belongsTo: jest.fn()
  })),
  DataTypes: {
    INTEGER: 'INTEGER',
    STRING: 'STRING',
    BOOLEAN: 'BOOLEAN',
    JSON: 'JSON',
    ENUM: jest.fn((values) => ({ type: 'ENUM', values }))
  }
};

// Mock the sequelize config
jest.mock('../../../src/config/database', () => ({
  sequelize: mockSequelize
}));

const defineUserSettings = require('../../../src/models/user-settings.model');

describe('UserSettings Model', () => {
  let mockModel;

  beforeEach(() => {
    jest.clearAllMocks();
    mockModel = {
      associate: jest.fn(),
      belongsTo: jest.fn()
    };
    mockSequelize.define.mockReturnValue(mockModel);
  });

  test('should define UserSettings model with correct attributes', () => {
    const UserSettings = defineUserSettings(mockSequelize, mockSequelize.DataTypes);

    expect(mockSequelize.define).toHaveBeenCalledWith('UserSettings', expect.objectContaining({
      id: expect.objectContaining({
        type: 'INTEGER',
        primaryKey: true,
        autoIncrement: true
      }),
      userId: expect.objectContaining({
        type: 'INTEGER',
        allowNull: false,
        unique: true
      }),
      timezone: expect.objectContaining({
        type: 'STRING',
        allowNull: false,
        defaultValue: 'UTC'
      }),
      dateFormat: expect.objectContaining({
        type: 'STRING',
        allowNull: false,
        defaultValue: 'YYYY-MM-DD'
      }),
      timeFormat: expect.objectContaining({
        type: 'STRING',
        allowNull: false,
        defaultValue: '24h'
      }),
      language: expect.objectContaining({
        type: 'STRING',
        allowNull: false,
        defaultValue: 'en'
      }),
      currency: expect.objectContaining({
        type: 'STRING',
        allowNull: false,
        defaultValue: 'USD'
      }),
      emailNotifications: expect.objectContaining({
        type: 'BOOLEAN',
        defaultValue: true
      }),
      smsNotifications: expect.objectContaining({
        type: 'BOOLEAN',
        defaultValue: false
      }),
      pushNotifications: expect.objectContaining({
        type: 'BOOLEAN',
        defaultValue: true
      }),
      bookingReminders: expect.objectContaining({
        type: 'BOOLEAN',
        defaultValue: true
      }),
      marketingEmails: expect.objectContaining({
        type: 'BOOLEAN',
        defaultValue: false
      }),
      theme: expect.objectContaining({
        defaultValue: 'light'
      }),
      bookingPageSettings: expect.objectContaining({
        type: 'JSON',
        defaultValue: expect.any(Object)
      }),
      privacySettings: expect.objectContaining({
        type: 'JSON',
        defaultValue: expect.any(Object)
      }),
      integrationSettings: expect.objectContaining({
        type: 'JSON',
        defaultValue: expect.any(Object)
      })
    }), expect.objectContaining({
      tableName: 'user_settings',
      timestamps: true,
      createdAt: 'created',
      updatedAt: 'updated'
    }));

    expect(UserSettings).toBe(mockModel);
  });

  test('should set up model associations', () => {
    const UserSettings = defineUserSettings(mockSequelize, mockSequelize.DataTypes);
    
    // Mock models for associations
    const mockModels = {
      User: { name: 'User' }
    };

    // Call the associate function
    if (UserSettings.associate) {
      UserSettings.associate(mockModels);
    }

    // Verify associations were set up
    expect(mockModel.belongsTo).toHaveBeenCalledWith(mockModels.User, {
      foreignKey: 'userId'
    });
  });

  test('should validate theme enum values', () => {
    defineUserSettings(mockSequelize, mockSequelize.DataTypes);

    const themeCall = mockSequelize.DataTypes.ENUM.mock.calls.find(call => 
      call[0] && call[0].includes('light')
    );
    
    expect(themeCall).toBeDefined();
    expect(themeCall[0]).toEqual(['light', 'dark', 'auto']);
  });

  test('should validate time format enum values', () => {
    defineUserSettings(mockSequelize, mockSequelize.DataTypes);

    const timeFormatCall = mockSequelize.DataTypes.ENUM.mock.calls.find(call => 
      call[0] && call[0].includes('12h')
    );
    
    expect(timeFormatCall).toBeDefined();
    expect(timeFormatCall[0]).toEqual(['12h', '24h']);
  });

  test('should have correct default values for JSON fields', () => {
    defineUserSettings(mockSequelize, mockSequelize.DataTypes);

    const defineCall = mockSequelize.define.mock.calls[0];
    const attributes = defineCall[1];
    
    expect(attributes.bookingPageSettings.defaultValue).toEqual({
      showAvatar: true,
      showBio: true,
      allowGuestBooking: true,
      requirePhone: false,
      customMessage: null
    });

    expect(attributes.privacySettings.defaultValue).toEqual({
      showBookingsPublically: false,
      allowSearchEngineIndexing: true,
      requireEmailVerification: true
    });

    expect(attributes.integrationSettings.defaultValue).toEqual({
      googleCalendar: { enabled: false, syncBidirectional: false },
      outlookCalendar: { enabled: false, syncBidirectional: false },
      zoom: { enabled: false, autoCreate: false }
    });
  });

  test('should have correct table configuration', () => {
    defineUserSettings(mockSequelize, mockSequelize.DataTypes);

    const defineCall = mockSequelize.define.mock.calls[0];
    const options = defineCall[2];

    expect(options.tableName).toBe('user_settings');
    expect(options.timestamps).toBe(true);
    expect(options.createdAt).toBe('created');
    expect(options.updatedAt).toBe('updated');
  });

  test('should have unique userId constraint', () => {
    defineUserSettings(mockSequelize, mockSequelize.DataTypes);

    const defineCall = mockSequelize.define.mock.calls[0];
    const attributes = defineCall[1];
    
    expect(attributes.userId.unique).toBe(true);
    expect(attributes.userId.allowNull).toBe(false);
  });
});