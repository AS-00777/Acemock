ALTER TABLE interviews
  MODIFY status ENUM('IN_PROGRESS','COMPLETED','ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS',
  ADD COLUMN interview_type VARCHAR(32) NULL DEFAULT 'technical',
  ADD INDEX idx_interviews_type (interview_type);

CREATE TABLE IF NOT EXISTS hr_interview_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  interview_id INT NOT NULL,
  question_id VARCHAR(100) NOT NULL,
  question_text TEXT NOT NULL,
  category VARCHAR(120) NOT NULL,
  answer_text TEXT NOT NULL,
  time_taken_seconds INT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 0,
  communication_score INT NOT NULL DEFAULT 0,
  confidence_score INT NOT NULL DEFAULT 0,
  structure_score INT NOT NULL DEFAULT 0,
  professionalism_score INT NOT NULL DEFAULT 0,
  star_score INT NOT NULL DEFAULT 0,
  follow_up_question TEXT NULL,
  follow_up_answer TEXT NULL,
  feedback TEXT NULL,
  strengths JSON NULL,
  weak_areas JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hr_answer_interview_question (interview_id, question_id),
  INDEX idx_hr_answers_interview_id (interview_id),
  CONSTRAINT fk_hr_answers_interview_id FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
