USE acemock;

ALTER TABLE answers
ADD COLUMN transcript TEXT NULL AFTER audio_status;
