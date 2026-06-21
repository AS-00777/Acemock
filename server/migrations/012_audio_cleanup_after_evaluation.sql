USE acemock;

ALTER TABLE answers
MODIFY COLUMN audio_status ENUM('uploaded','pending_transcription','transcribed','failed','deleted') NULL;

ALTER TABLE answers
ADD COLUMN audio_deleted_at DATETIME NULL AFTER audio_status;
