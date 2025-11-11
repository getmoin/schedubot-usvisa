-- ========================================
-- V3 USA Visa Scheduler - Database Schema
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- Credentials Table
-- ========================================
CREATE TABLE IF NOT EXISTS credentials (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_encrypted TEXT NOT NULL,
    country VARCHAR(10) NOT NULL DEFAULT 'ca',
    user_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credentials_email ON credentials(email);

-- ========================================
-- Appointment Checks History
-- ========================================
CREATE TABLE IF NOT EXISTS appointment_checks (
    id SERIAL PRIMARY KEY,
    check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    facility_id INT NOT NULL,
    facility_name VARCHAR(100),
    earliest_date DATE,
    available_slots JSONB,  -- Array of time slots
    check_duration_ms INT,
    status VARCHAR(50) NOT NULL,  -- 'success', 'no_slots', 'error'
    error_message TEXT,
    CONSTRAINT check_status_valid CHECK (status IN ('success', 'no_slots', 'error'))
);

CREATE INDEX idx_checks_time ON appointment_checks(check_time DESC);
CREATE INDEX idx_checks_facility ON appointment_checks(facility_id);
CREATE INDEX idx_checks_status ON appointment_checks(status);

-- ========================================
-- Booking Attempts
-- ========================================
CREATE TABLE IF NOT EXISTS booking_attempts (
    id SERIAL PRIMARY KEY,
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    facility_id INT NOT NULL,
    facility_name VARCHAR(100),
    target_date DATE NOT NULL,
    time_slot VARCHAR(10),
    attempt_number INT NOT NULL,
    status VARCHAR(50) NOT NULL,  -- 'trying', 'success', 'failed'
    error_message TEXT,
    duration_ms INT,
    CONSTRAINT booking_status_valid CHECK (status IN ('trying', 'success', 'failed'))
);

CREATE INDEX idx_booking_time ON booking_attempts(attempt_time DESC);
CREATE INDEX idx_booking_status ON booking_attempts(status);
CREATE INDEX idx_booking_date ON booking_attempts(target_date);

-- ========================================
-- Current Appointment Tracking
-- ========================================
CREATE TABLE IF NOT EXISTS current_appointment (
    id SERIAL PRIMARY KEY,
    appointment_date DATE NOT NULL,
    facility_id INT NOT NULL,
    facility_name VARCHAR(100),
    time_slot VARCHAR(10),
    booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_current_active ON current_appointment(is_active);

-- ========================================
-- Application State
-- ========================================
CREATE TABLE IF NOT EXISTS app_state (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- Session Management
-- ========================================
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    cookies JSONB NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_validated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_valid BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_session_valid ON sessions(is_valid);

-- ========================================
-- Error Logs
-- ========================================
CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    error_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_type VARCHAR(100),
    error_message TEXT,
    stack_trace TEXT,
    context JSONB,  -- Additional context (function name, params, etc.)
    severity VARCHAR(20) DEFAULT 'error'  -- 'debug', 'info', 'warn', 'error', 'fatal'
);

CREATE INDEX idx_error_time ON error_logs(error_time DESC);
CREATE INDEX idx_error_type ON error_logs(error_type);
CREATE INDEX idx_error_severity ON error_logs(severity);

-- ========================================
-- Functions for automatic timestamp updates
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to credentials table
CREATE TRIGGER update_credentials_updated_at BEFORE UPDATE ON credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to app_state table
CREATE TRIGGER update_app_state_updated_at BEFORE UPDATE ON app_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Initial Data
-- ========================================

-- Insert facility mapping
INSERT INTO app_state (key, value) VALUES
    ('facility_map', '{"94": "Toronto", "89": "Calgary", "95": "Vancouver"}')
ON CONFLICT (key) DO NOTHING;

-- Insert app version
INSERT INTO app_state (key, value) VALUES
    ('app_version', '"3.0.0"')
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- Utility Views
-- ========================================

-- View: Recent booking attempts
CREATE OR REPLACE VIEW recent_booking_attempts AS
SELECT
    ba.attempt_time,
    ba.facility_name,
    ba.target_date,
    ba.time_slot,
    ba.attempt_number,
    ba.status,
    ba.error_message
FROM booking_attempts ba
ORDER BY ba.attempt_time DESC
LIMIT 100;

-- View: Check statistics (last 24 hours)
CREATE OR REPLACE VIEW check_statistics AS
SELECT
    facility_name,
    COUNT(*) as total_checks,
    COUNT(*) FILTER (WHERE status = 'success') as successful_checks,
    COUNT(*) FILTER (WHERE status = 'no_slots') as no_slots_checks,
    COUNT(*) FILTER (WHERE status = 'error') as error_checks,
    AVG(check_duration_ms) as avg_duration_ms,
    MAX(check_time) as last_check_time
FROM appointment_checks
WHERE check_time > NOW() - INTERVAL '24 hours'
GROUP BY facility_name;

-- ========================================
-- Grants (if needed for specific user)
-- ========================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO visabot;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO visabot;

-- ========================================
-- Comments
-- ========================================
COMMENT ON TABLE credentials IS 'Encrypted user credentials for visa portal login';
COMMENT ON TABLE appointment_checks IS 'Historical log of all facility checks';
COMMENT ON TABLE booking_attempts IS 'All booking attempts with success/failure status';
COMMENT ON TABLE current_appointment IS 'Currently active appointment information';
COMMENT ON TABLE app_state IS 'Application state and configuration storage';
COMMENT ON TABLE sessions IS 'Browser session cookies and metadata';
COMMENT ON TABLE error_logs IS 'Application error logs for debugging';

COMMENT ON COLUMN credentials.password_encrypted IS 'AES-256 encrypted password';
COMMENT ON COLUMN appointment_checks.available_slots IS 'JSON array of available time slots';
COMMENT ON COLUMN app_state.value IS 'JSONB value for flexible storage';
COMMENT ON COLUMN sessions.cookies IS 'Playwright browser cookies in JSON format';

-- ========================================
-- Success Message
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '✅ Database schema initialized successfully!';
    RAISE NOTICE '📊 Tables created: credentials, appointment_checks, booking_attempts, current_appointment, app_state, sessions, error_logs';
    RAISE NOTICE '📈 Views created: recent_booking_attempts, check_statistics';
END $$;
