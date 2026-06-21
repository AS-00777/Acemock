USE acemock;

ALTER TABLE questions
ADD COLUMN test_cases JSON NULL AFTER topic,
ADD COLUMN hidden_test_cases JSON NULL AFTER test_cases,
ADD COLUMN expected_time_complexity VARCHAR(255) NULL AFTER hidden_test_cases,
ADD COLUMN expected_space_complexity VARCHAR(255) NULL AFTER expected_time_complexity;
