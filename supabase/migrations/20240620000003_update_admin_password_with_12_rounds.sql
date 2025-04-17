-- Update admin password hash with a 12-round bcrypt hash for 'admin123'
UPDATE admin_credentials
SET password_hash = '$2a$12$ywfXlm2Kj4ZhRxJVBKDN8.Pd9MXVrV3jtLnKXta.nZFNQJU6NbBOO', -- 12-round hash for 'admin123'
    updated_at = NOW()
WHERE user_id IN (SELECT id FROM users WHERE role = 'admin');
