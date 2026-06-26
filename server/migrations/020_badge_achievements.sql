CREATE TABLE IF NOT EXISTS badges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(50),
  category VARCHAR(50),
  target_value INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_badges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  badge_code VARCHAR(100) NOT NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_badge (user_id, badge_code)
);

CREATE TABLE IF NOT EXISTS user_daily_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  activity_date DATE NOT NULL,
  interview_count INT DEFAULT 0,
  aptitude_count INT DEFAULT 0,
  technical_mcq_count INT DEFAULT 0,
  resume_scan_count INT DEFAULT 0,
  spoken_practice_count INT DEFAULT 0,
  total_activity_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_day (user_id, activity_date)
);

INSERT IGNORE INTO badges (code, name, description, icon, category, target_value) VALUES
  ('FIRST_INTERVIEW', 'First Step', 'Complete your first mock interview.', 'target', 'interview', 1),
  ('THREE_DAY_STREAK', 'Consistent Learner', 'Practice for 3 days continuously.', 'flame', 'streak', 3),
  ('SEVEN_DAY_STREAK', 'Weekly Warrior', 'Practice for 7 days continuously.', 'zap', 'streak', 7),
  ('TEN_INTERVIEWS', 'Interview Grinder', 'Complete 10 mock interviews.', 'mic', 'interview', 10),
  ('SCORE_80_INTERVIEW', 'Strong Performer', 'Score 80% or above in any mock interview.', 'trophy', 'interview', 80),
  ('FIRST_APTITUDE', 'Aptitude Starter', 'Complete your first aptitude test.', 'brain', 'aptitude', 1),
  ('SCORE_90_APTITUDE', 'Aptitude Master', 'Score 90% or above in any aptitude test.', 'lightbulb', 'aptitude', 90),
  ('ATS_80', 'Resume Ready', 'Get 80% or above ATS score.', 'file-check', 'resume', 80),
  ('ALL_ROUNDER', 'All Rounder', 'Complete interview, aptitude, and resume scan at least once.', 'sparkles', 'overall', 3);
