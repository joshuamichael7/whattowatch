-- Update admin password with a standard bcrypt hash for 'admin123'
-- This hash was generated with bcryptjs using 10 rounds and the $2a$ prefix
UPDATE admin_credentials
SET password_hash = '$2a$10$rPQcqxoKVBM/IVtNSGHBR.pu.tg.Ce9yZhmzYy0jkCpVo47tpAYZm',
    updated_at = NOW()
WHERE user_id IN (SELECT id FROM users WHERE role = 'admin');
