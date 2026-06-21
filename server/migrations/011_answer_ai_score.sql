USE acemock;

ALTER TABLE answers
ADD COLUMN ai_score INT NULL AFTER nlp_summary;
