USE acemock;

DROP PROCEDURE IF EXISTS add_answer_column_if_missing;

DELIMITER //
CREATE PROCEDURE add_answer_column_if_missing(
  IN column_name VARCHAR(64),
  IN column_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'answers'
      AND COLUMN_NAME = column_name
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE answers ADD COLUMN ', column_name, ' ', column_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

CALL add_answer_column_if_missing('nlp_score', 'INT NULL');
CALL add_answer_column_if_missing('ai_score', 'INT NULL');
CALL add_answer_column_if_missing('confidence_score', 'INT NULL');
CALL add_answer_column_if_missing('fluency_score', 'INT NULL');
CALL add_answer_column_if_missing('clarity_score', 'INT NULL');
CALL add_answer_column_if_missing('filler_words_count', 'INT DEFAULT 0');
CALL add_answer_column_if_missing('corrected_transcript', 'TEXT NULL');

DROP PROCEDURE IF EXISTS add_answer_column_if_missing;
