-- Create a profile for the existing authenticated user
INSERT INTO users (id, email, role, created_at, updated_at)
VALUES ('dea0c020-e2d3-469f-b7ff-913262a81dbe', 'joshmputnam@gmail.com', 'admin', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
