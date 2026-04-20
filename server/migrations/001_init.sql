-- AceMock AI schema (MySQL)
-- Run: mysql -u root -p acemock < migrations/001_init.sql
use acemock;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS interviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role VARCHAR(255) NOT NULL,
  experience VARCHAR(255) NOT NULL,
  tech_stack JSON NOT NULL,
  status ENUM('IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'IN_PROGRESS',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  INDEX idx_interviews_user_id (user_id),
  CONSTRAINT fk_interviews_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  interview_id INT NOT NULL,
  question_text TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_questions_interview_id (interview_id),
  CONSTRAINT fk_questions_interview_id FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NOT NULL,
  answer_text TEXT NOT NULL,
  score INT NULL,
  feedback TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_answers_question_id (question_id),
  CONSTRAINT fk_answers_question_id FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  interview_id INT NOT NULL UNIQUE,
  overall_score INT NOT NULL,
  summary TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_results_interview_id (interview_id),
  CONSTRAINT fk_results_interview_id FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

