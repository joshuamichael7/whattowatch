-- Set admin role for specific user
UPDATE public.users
SET role = 'admin'
WHERE id = 'dea0c020-e2d3-469f-b7ff-913262a81dbe';

-- If the user doesn't exist in the public.users table yet, insert them
INSERT INTO public.users (id, email, role, created_at, updated_at)
SELECT 'dea0c020-e2d3-469f-b7ff-913262a81dbe', 'joshmputnam@gmail.com', 'admin', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE id = 'dea0c020-e2d3-469f-b7ff-913262a81dbe');
