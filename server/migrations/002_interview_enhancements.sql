-- -- AceMock AI schema update: interview enhancements (MySQL)
-- -- Run (after 001_init.sql): mysql -u root -p acemock < migrations/002_interview_enhancements.sql

-- use acemock;

-- -- Store interview difficulty explicitly (also still present in tech_stack JSON for back-compat)
-- ALTER TABLE interviews
--   ADD COLUMN difficulty ENUM('Easy','Medium','Hard') NULL AFTER experience;

-- -- Tag each question so the client can render theory vs coding UI.
-- ALTER TABLE questions
--   ADD COLUMN question_type ENUM('THEORY','CODING') NOT NULL DEFAULT 'THEORY' AFTER question_text;

-- -- Store AI evaluation rating + optional code submission metadata.
-- ALTER TABLE answers
--   ADD COLUMN rating ENUM('Poor','Average','Good','Excellent') NULL AFTER score,
--   ADD COLUMN language VARCHAR(32) NULL AFTER rating,
--   ADD COLUMN code TEXT NULL AFTER answer_text;

USE acemock;

-- Add difficulty to interviews
ALTER TABLE interviews
ADD COLUMN difficulty ENUM('easy','medium','hard') NOT NULL DEFAULT 'medium' AFTER experience;

-- Add question type (theory/coding)
ALTER TABLE questions
ADD COLUMN question_type ENUM('theory','coding') NOT NULL DEFAULT 'theory' AFTER question_text;

-- Add AI evaluation + coding support
ALTER TABLE answers
ADD COLUMN rating ENUM('Poor','Average','Good','Excellent') NULL AFTER score,
ADD COLUMN language VARCHAR(32) NULL AFTER rating,
ADD COLUMN code TEXT NULL AFTER answer_text;
