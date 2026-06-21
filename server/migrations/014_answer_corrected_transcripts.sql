USE acemock;

ALTER TABLE answers
ADD COLUMN raw_transcript TEXT NULL AFTER transcript,
ADD COLUMN corrected_transcript TEXT NULL AFTER raw_transcript;
