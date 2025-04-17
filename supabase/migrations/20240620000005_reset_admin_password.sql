-- Reset admin password to a default value that will be changed through the UI
-- This is a temporary solution until the admin resets their password through the UI
UPDATE admin_credentials
SET password_hash = '$2a$10$ywfXlm2Kj4ZhRxJVBKDN8.Pd9MXVrV3jtLnKXta.nZFNQJU6NbBOO', -- Default hash for 'admin123'
    updated_at = NOW()
WHERE user_id IN (SELECT id FROM users WHERE role = 'admin');
