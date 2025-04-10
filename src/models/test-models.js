/**
 * Test models
 * 
 * Creates all models with an SQLite database for testing
 * 
 * @author meetabl Team
 */

// Import Sequelize
const { Sequelize, DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// Create a SQLite in-memory database for testing
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false
});

// Define models
const User = sequelize.define('User', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  timezone: {
    type: DataTypes.STRING(50),
    defaultValue: 'UTC'
  },
  calendar_provider: {
    type: DataTypes.ENUM('none', 'google', 'microsoft'),
    defaultValue: 'none'
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true
});

const UserSettings = sequelize.define('UserSettings', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  user_id: {
    type: DataTypes.STRING(36),
    allowNull: false
  },
  branding_color: {
    type: DataTypes.STRING(7),
    defaultValue: '#4f46e5' // Indigo
  },
  confirmation_email_copy: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  accessibility_mode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  alt_text_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  notification_email: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notification_sms: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'user_settings',
  timestamps: true,
  underscored: true
});

const AvailabilityRule = sequelize.define('AvailabilityRule', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  user_id: {
    type: DataTypes.STRING(36),
    allowNull: false
  },
  day_of_week: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 6
    }
  },
  start_time: {
    type: DataTypes.TIME,
    allowNull: false
  },
  end_time: {
    type: DataTypes.TIME,
    allowNull: false
  },
  buffer_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  max_bookings_per_day: {
    type: DataTypes.INTEGER,
    defaultValue: 0 // 0 means unlimited
  }
}, {
  tableName: 'availability_rules',
  timestamps: true,
  underscored: true
});

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  user_id: {
    type: DataTypes.STRING(36),
    allowNull: false
  },
  customer_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  customer_email: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  customer_phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('confirmed', 'cancelled', 'rescheduled'),
    defaultValue: 'confirmed'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  calendar_event_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'bookings',
  timestamps: true,
  underscored: true
});

const CalendarToken = sequelize.define('CalendarToken', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  user_id: {
    type: DataTypes.STRING(36),
    allowNull: false
  },
  provider: {
    type: DataTypes.ENUM('google', 'microsoft'),
    allowNull: false
  },
  access_token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  scope: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'calendar_tokens',
  timestamps: true,
  underscored: true
});

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  booking_id: {
    type: DataTypes.STRING(36),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('email', 'sms'),
    allowNull: false
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'failed'),
    defaultValue: 'pending'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'notifications',
  timestamps: false
});

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  user_id: {
    type: DataTypes.STRING(36),
    allowNull: false
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  user_agent: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  underscored: true
});

// Define associations
User.hasOne(UserSettings, { foreignKey: 'user_id', onDelete: 'CASCADE' });
UserSettings.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(AvailabilityRule, { foreignKey: 'user_id', onDelete: 'CASCADE' });
AvailabilityRule.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Booking, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Booking.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(CalendarToken, { foreignKey: 'user_id', onDelete: 'CASCADE' });
CalendarToken.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(AuditLog, { foreignKey: 'user_id', onDelete: 'CASCADE' });
AuditLog.belongsTo(User, { foreignKey: 'user_id' });

Booking.hasMany(Notification, { foreignKey: 'booking_id', onDelete: 'CASCADE' });
Notification.belongsTo(Booking, { foreignKey: 'booking_id' });

// Initialize the database for testing
const initializeTestDatabase = async () => {
  await sequelize.sync({ force: true });
  return sequelize;
};

module.exports = {
  sequelize,
  User,
  UserSettings,
  AvailabilityRule,
  Booking,
  CalendarToken,
  Notification,
  AuditLog,
  initializeTestDatabase
};