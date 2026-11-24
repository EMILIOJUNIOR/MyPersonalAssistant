CREATE TABLE IF NOT EXISTS tenant_preferences (
  tenant_id  TEXT PRIMARY KEY,
  user_name  TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO tenant_preferences (tenant_id, user_name, created_at, updated_at)
VALUES ('1357657470', 'MilhoJr', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
