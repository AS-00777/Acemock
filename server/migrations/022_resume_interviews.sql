CREATE TABLE IF NOT EXISTS resumes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  extracted_text MEDIUMTEXT NOT NULL,
  parsed_profile JSON NOT NULL,
  document_type VARCHAR(64) NOT NULL,
  validation_status VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_resumes_user_id (user_id),
  CONSTRAINT fk_resumes_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE interviews
  ADD COLUMN interview_source VARCHAR(32) NULL DEFAULT 'MOCK_FORM',
  ADD COLUMN resume_id INT NULL,
  ADD INDEX idx_interviews_source (interview_source),
  ADD INDEX idx_interviews_resume_id (resume_id),
  ADD CONSTRAINT fk_interviews_resume_id FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE SET NULL;
