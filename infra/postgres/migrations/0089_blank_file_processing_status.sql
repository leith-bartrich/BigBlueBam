-- 0089_blank_file_processing_status.sql
-- Why: Enable worker jobs to track file upload processing state and errors. Store MinIO URLs after successful processing.
-- Client impact: additive only. New nullable columns and JSONB field for file metadata.

ALTER TABLE blank_submissions
  ADD COLUMN IF NOT EXISTS file_processing_status VARCHAR(20) DEFAULT 'pending';

ALTER TABLE blank_submissions
  ADD COLUMN IF NOT EXISTS file_processing_error TEXT;

ALTER TABLE blank_submissions
  ADD COLUMN IF NOT EXISTS processed_files JSONB DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blank_submissions_file_status_check') THEN
    ALTER TABLE blank_submissions
      ADD CONSTRAINT blank_submissions_file_status_check
      CHECK (file_processing_status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_blank_submissions_file_status
  ON blank_submissions (file_processing_status)
  WHERE file_processing_status IN ('pending', 'in_progress');
