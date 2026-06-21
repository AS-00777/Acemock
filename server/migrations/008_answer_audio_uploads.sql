USE acemock;

ALTER TABLE answers
ADD COLUMN audio_file_path VARCHAR(1024) NULL AFTER language,
ADD COLUMN audio_status ENUM('uploaded','pending_transcription','transcribed','failed') NULL AFTER audio_file_path;
