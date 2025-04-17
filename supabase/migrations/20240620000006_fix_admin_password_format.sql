-- Reset admin password with a properly formatted bcrypt hash
UPDATE admin_credentials
SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    updated_at = NOW()
WHERE user_id IN (SELECT id FROM users WHERE role = 'admin');
