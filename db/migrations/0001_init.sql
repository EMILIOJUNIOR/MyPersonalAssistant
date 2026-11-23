CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'done', 'cancelled')),
  priority      TEXT NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('low', 'normal', 'high')),
  due_at        TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  completed_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_due
  ON tasks (status, due_at);

CREATE TABLE IF NOT EXISTS reminders (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL
              REFERENCES tasks(id) ON DELETE CASCADE,
  remind_at   TEXT NOT NULL,
  sent_at     TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_pending
  ON reminders (remind_at)
  WHERE sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reminders_task
  ON reminders (task_id);