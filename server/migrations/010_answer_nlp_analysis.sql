USE acemock;

ALTER TABLE answers
ADD COLUMN nlp_score INT NULL AFTER transcript,
ADD COLUMN answer_length INT NULL AFTER nlp_score,
ADD COLUMN nlp_missing_concepts JSON NULL AFTER answer_length,
ADD COLUMN filler_words_count INT NULL AFTER nlp_missing_concepts,
ADD COLUMN fluency_score INT NULL AFTER filler_words_count,
ADD COLUMN clarity_score INT NULL AFTER fluency_score,
ADD COLUMN nlp_summary TEXT NULL AFTER clarity_score;
