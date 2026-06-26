CREATE TABLE IF NOT EXISTS aptitude_questions (
  question_id VARCHAR(100) NOT NULL PRIMARY KEY,
  source VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  section VARCHAR(100) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  difficulty VARCHAR(50) NOT NULL,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer CHAR(1) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_aptitude_questions_section_topic (section, topic),
  INDEX idx_aptitude_questions_company (company),
  INDEX idx_aptitude_questions_difficulty (difficulty),
  CONSTRAINT chk_aptitude_questions_correct_answer
    CHECK (correct_answer IN ('A', 'B', 'C', 'D'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aptitude_tests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'Aptitude Practice Test',
  company VARCHAR(255) NULL,
  company VARCHAR(255) NULL,
  section VARCHAR(100) NULL,
  topic VARCHAR(255) NULL,
  difficulty VARCHAR(50) NULL,
  total_questions INT UNSIGNED NOT NULL,
  duration_minutes INT UNSIGNED NULL,
  status ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED')
    NOT NULL DEFAULT 'NOT_STARTED',
  score DECIMAL(6,2) NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_aptitude_tests_user_created (user_id, created_at),
  INDEX idx_aptitude_tests_status (status),
  CONSTRAINT fk_aptitude_tests_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aptitude_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  test_id BIGINT UNSIGNED NOT NULL,
  question_id VARCHAR(100) NOT NULL,
  selected_answer CHAR(1) NULL,
  correct_answer CHAR(1) NULL,
  correct_answer CHAR(1) NULL,
  is_correct BOOLEAN NULL,
  time_taken_seconds INT UNSIGNED NULL,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_aptitude_attempts_test_question (test_id, question_id),
  INDEX idx_aptitude_attempts_question (question_id),
  CONSTRAINT chk_aptitude_attempts_selected_answer
    CHECK (selected_answer IS NULL OR selected_answer IN ('A', 'B', 'C', 'D')),
  CONSTRAINT chk_aptitude_attempts_correct_answer
    CHECK (correct_answer IS NULL OR correct_answer IN ('A', 'B', 'C', 'D')),
  CONSTRAINT chk_aptitude_attempts_correct_answer
    CHECK (correct_answer IS NULL OR correct_answer IN ('A', 'B', 'C', 'D')),
  CONSTRAINT fk_aptitude_attempts_test
    FOREIGN KEY (test_id) REFERENCES aptitude_tests(id) ON DELETE CASCADE,
  CONSTRAINT fk_aptitude_attempts_question
    FOREIGN KEY (question_id) REFERENCES aptitude_questions(question_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
