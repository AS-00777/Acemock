USE acemock;

ALTER TABLE users
ADD COLUMN clerk_id VARCHAR(255) NULL AFTER id,
ADD COLUMN auth_provider VARCHAR(50) NOT NULL DEFAULT 'clerk' AFTER password;

ALTER TABLE users
MODIFY COLUMN password VARCHAR(255) NULL;

CREATE UNIQUE INDEX idx_users_clerk_id ON users (clerk_id);
