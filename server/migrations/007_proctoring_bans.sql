USE acemock;

ALTER TABLE interviews
ADD COLUMN warning_count INT NOT NULL DEFAULT 0 AFTER status;

ALTER TABLE users
ADD COLUMN banned_until DATETIME NULL AFTER deleted_at,
ADD COLUMN ban_reason TEXT NULL AFTER banned_until;
