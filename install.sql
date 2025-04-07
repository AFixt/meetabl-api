

-- USERS
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    timezone VARCHAR(100) NOT NULL,
    calendar_provider ENUM('none', 'google', 'microsoft') DEFAULT 'none',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- CALENDAR TOKENS
CREATE TABLE calendar_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    provider ENUM('google', 'microsoft') NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    scope TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- AVAILABILITY RULES
CREATE TABLE availability_rules (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    buffer_minutes SMALLINT DEFAULT 0,
    max_bookings_per_day SMALLINT DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- BOOKINGS
CREATE TABLE bookings (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    calendar_event_id VARCHAR(255),
    status ENUM('confirmed', 'cancelled') DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- NOTIFICATIONS
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    booking_id UUID NOT NULL,
    type ENUM('email', 'sms') NOT NULL,
    sent_at TIMESTAMP,
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
    error_message TEXT,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- USER SETTINGS
CREATE TABLE user_settings (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    branding_color VARCHAR(7) DEFAULT '#000000',
    confirmation_email_copy TEXT,
    accessibility_mode BOOLEAN DEFAULT TRUE,
    alt_text_enabled BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- AUDIT LOGS
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- INDEXES
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_booking_user ON bookings(user_id);
CREATE INDEX idx_availability_user ON availability_rules(user_id);
CREATE INDEX idx_calendar_token_user ON calendar_tokens(user_id);
