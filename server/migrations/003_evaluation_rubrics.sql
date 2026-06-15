USE acemock;

ALTER TABLE questions
ADD COLUMN expected_answer TEXT NULL AFTER question_type,
ADD COLUMN key_concepts JSON NULL AFTER expected_answer,
ADD COLUMN difficulty ENUM('easy','medium','hard') NULL AFTER key_concepts,
ADD COLUMN topic VARCHAR(255) NULL AFTER difficulty;

ALTER TABLE answers
ADD COLUMN technical_accuracy INT NULL AFTER score,
ADD COLUMN concept_coverage INT NULL AFTER technical_accuracy,
ADD COLUMN communication_score INT NULL AFTER concept_coverage,
ADD COLUMN semantic_similarity INT NULL AFTER communication_score,
ADD COLUMN final_score INT NULL AFTER semantic_similarity,
ADD COLUMN matched_concepts JSON NULL AFTER final_score,
ADD COLUMN missing_concepts JSON NULL AFTER matched_concepts,
ADD COLUMN strengths TEXT NULL AFTER feedback,
ADD COLUMN weaknesses TEXT NULL AFTER strengths;
