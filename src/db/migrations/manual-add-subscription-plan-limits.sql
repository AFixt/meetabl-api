-- Migration: Add subscription plan limit fields

ALTER TABLE users 
ADD COLUMN plan_type ENUM('free', 'paid') NOT NULL DEFAULT 'free' COMMENT 'User subscription plan type';

ALTER TABLE users 
ADD COLUMN max_calendars INT NOT NULL DEFAULT 1 COMMENT 'Maximum number of calendars allowed';

ALTER TABLE users 
ADD COLUMN max_event_types INT NOT NULL DEFAULT 1 COMMENT 'Maximum number of event types allowed';

ALTER TABLE users 
ADD COLUMN integrations_enabled BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether calendar integrations are enabled';

ALTER TABLE users 
ADD COLUMN billing_period ENUM('monthly', 'annual') NULL COMMENT 'Billing period for paid subscriptions';

ALTER TABLE users 
ADD COLUMN applied_discount_code VARCHAR(50) NULL COMMENT 'Discount code applied to subscription';

-- Add index for plan type
CREATE INDEX idx_users_plan_type ON users(plan_type);

-- Record the migration
INSERT INTO SequelizeMeta (name) VALUES ('20250720141435-add-subscription-plan-limits.js');