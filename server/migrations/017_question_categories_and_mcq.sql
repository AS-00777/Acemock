USE acemock;

ALTER TABLE questions
MODIFY COLUMN question_type ENUM('theory','coding','mcq','practical','scenario') NOT NULL DEFAULT 'theory',
ADD COLUMN options_json JSON NULL AFTER evaluation_type,
ADD COLUMN correct_option VARCHAR(10) NULL AFTER options_json,
ADD COLUMN explanation TEXT NULL AFTER correct_option;
