ALTER TABLE user_profiles
ADD COLUMN full_name VARCHAR(255) NULL,
ADD COLUMN email VARCHAR(255) NULL;

UPDATE user_profiles up
JOIN users u ON up.user_id = u.id
SET up.full_name = u.name,
    up.email = u.email;
