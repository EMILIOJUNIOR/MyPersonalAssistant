CREATE TABLE IF NOT EXISTS appointments (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  start_at   TEXT NOT NULL,
  end_at     TEXT NOT NULL,
  location   TEXT,
  notes      TEXT,
  status     TEXT NOT NULL DEFAULT 'confirmed'
             CHECK (status IN ('confirmed', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_appointments_start
  ON appointments (status, start_at);
