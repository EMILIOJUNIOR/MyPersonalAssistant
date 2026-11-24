CREATE TABLE IF NOT EXISTS appointment_reminders (
  id             TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL
                 REFERENCES appointments(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL
                 CHECK (kind IN ('24h', '15m')),
  remind_at      TEXT NOT NULL,
  sent_at        TEXT,
  created_at     TEXT NOT NULL,
  UNIQUE (appointment_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_appointment_reminders_pending
  ON appointment_reminders (remind_at)
  WHERE sent_at IS NULL;
