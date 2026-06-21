USE acemock;

ALTER TABLE answers
ADD COLUMN factor_scores JSON NULL AFTER missing_concepts,
ADD COLUMN suggestions TEXT NULL AFTER weaknesses;
