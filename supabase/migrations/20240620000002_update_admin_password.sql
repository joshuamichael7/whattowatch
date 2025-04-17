-- Update admin password hash with a freshly generated one for 'admin123'
UPDATE admin_credentials
SET password_hash = '$2a$10$ywfXlm2Kj4ZhRxJVBKDN8.Pd9MXVrV3jtLnKXta.nZFNQJU6NbBOO', -- New hash for 'admin123'
    updated_at = NOW()
WHERE user_id IN (SELECT id FROM users WHERE role = 'admin');
