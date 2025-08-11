-- Create booking_requests table
CREATE TABLE IF NOT EXISTS booking_requests (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(25),
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    notes TEXT,
    confirmation_token VARCHAR(255) NOT NULL UNIQUE,
    status ENUM('pending', 'confirmed', 'expired', 'cancelled') DEFAULT 'pending' NOT NULL,
    expires_at DATETIME NOT NULL,
    confirmed_at DATETIME,
    created DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated DATETIME ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_confirmation_token (confirmation_token),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at),
    INDEX idx_time_range (start_time, end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;