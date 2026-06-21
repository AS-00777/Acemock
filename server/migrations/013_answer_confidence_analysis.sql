USE acemock;

ALTER TABLE answers
ADD COLUMN confidence_score INT NULL AFTER ai_score,
ADD COLUMN confidence_level ENUM('High','Medium','Low') NULL AFTER confidence_score,
ADD COLUMN confidence_reasons JSON NULL AFTER confidence_level,
ADD COLUMN confidence_tips JSON NULL AFTER confidence_reasons;
