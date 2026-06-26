ALTER TABLE interviews
  ADD COLUMN personality VARCHAR(64) NOT NULL DEFAULT 'Senior Engineering Manager' AFTER experience,
  ADD COLUMN follow_up_count INT NOT NULL DEFAULT 0 AFTER warning_count;

ALTER TABLE answers
  ADD COLUMN follow_up_question TEXT NULL AFTER answer_text,
  ADD COLUMN follow_up_answer TEXT NULL AFTER follow_up_question,
  ADD COLUMN follow_up_reason VARCHAR(500) NULL AFTER follow_up_answer,
  ADD COLUMN interviewer_reaction VARCHAR(500) NULL AFTER follow_up_reason,
  ADD COLUMN time_taken_seconds INT NULL AFTER interviewer_reaction,
  ADD COLUMN follow_up_time_taken_seconds INT NULL AFTER time_taken_seconds,
  ADD COLUMN main_answer_score INT NULL AFTER final_score,
  ADD COLUMN follow_up_score INT NULL AFTER main_answer_score;

ALTER TABLE results
  ADD COLUMN question_wise_results JSON NULL AFTER summary,
  ADD COLUMN recommended_focus_areas JSON NULL AFTER question_wise_results;
