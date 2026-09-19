CREATE TABLE IF NOT EXISTS account_storage (
  account_id TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, storage_key),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS account_storage_updated_at_idx
  ON account_storage(updated_at);
