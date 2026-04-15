-- 0113_helpdesk_email_verification_hashing.sql
-- Why: HB-44 security fix. Hash email verification tokens with SHA-256 to prevent offline brute-force if DB is compromised.
-- Client impact: expand-contract step 1. Hashed column added; application hashes on insert going forward. In-flight plaintext tokens expire naturally within 24 hours.

ALTER TABLE helpdesk_users
  ADD COLUMN IF NOT EXISTS email_verification_token_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_helpdesk_users_email_verification_token_hash
  ON helpdesk_users (email_verification_token_hash);
