USE acemock;

ALTER TABLE questions
ADD COLUMN skill VARCHAR(255) NULL AFTER topic,
ADD COLUMN language VARCHAR(32) NULL AFTER skill,
ADD COLUMN starter_code TEXT NULL AFTER language,
ADD COLUMN constraints_json JSON NULL AFTER hidden_test_cases,
ADD COLUMN expected_output TEXT NULL AFTER constraints_json,
ADD COLUMN evaluation_type VARCHAR(32) NULL AFTER expected_output;
