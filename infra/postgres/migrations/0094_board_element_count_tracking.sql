-- 0094_board_element_count_tracking.sql
-- Why: Track element count per board for soft warning (500) and hard limit (2000) enforcement per design.
-- Client impact: additive only.

ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS element_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_boards_element_count
  ON boards (element_count)
  WHERE element_count > 500;
