-- LumIA — schema completo para Turso/libSQL.
--
-- Uso:
--   turso db shell <nome-do-banco> < db/turso-schema.sql
--
-- O script é idempotente e registra as migrações aplicadas para que
-- `npm run db:migrate` não tente executar novamente os ALTER TABLE.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS _migrations (
  id         TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_preferences (
  tenant_id  TEXT PRIMARY KEY,
  user_name  TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'paused', 'done', 'archived')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_status
  ON projects (status, updated_at);

CREATE TABLE IF NOT EXISTS entries (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  kind       TEXT NOT NULL
             CHECK (kind IN ('idea', 'note', 'decision', 'summary', 'reference')),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  tags       TEXT NOT NULL DEFAULT '[]',
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'archived')),
  metadata   TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_kind_created
  ON entries (kind, created_at);

CREATE INDEX IF NOT EXISTS idx_entries_project
  ON entries (project_id, created_at);

CREATE INDEX IF NOT EXISTS idx_entries_status
  ON entries (status, updated_at);

CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  title        TEXT NOT NULL,
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'done', 'cancelled')),
  priority     TEXT NOT NULL DEFAULT 'normal'
               CHECK (priority IN ('low', 'normal', 'high')),
  due_at       TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  completed_at TEXT,
  project_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
  entry_id     TEXT REFERENCES entries(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_due
  ON tasks (status, due_at);

CREATE INDEX IF NOT EXISTS idx_tasks_project
  ON tasks (project_id, status);

CREATE TABLE IF NOT EXISTS reminders (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  task_id    TEXT NOT NULL
             REFERENCES tasks(id) ON DELETE CASCADE,
  remind_at  TEXT NOT NULL,
  sent_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_pending
  ON reminders (remind_at)
  WHERE sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reminders_task
  ON reminders (task_id);

CREATE TABLE IF NOT EXISTS entry_links (
  id            TEXT PRIMARY KEY,
  from_entry_id TEXT NOT NULL
                REFERENCES entries(id) ON DELETE CASCADE,
  to_entry_id   TEXT NOT NULL
                REFERENCES entries(id) ON DELETE CASCADE,
  relation      TEXT NOT NULL DEFAULT 'related',
  created_at    TEXT NOT NULL,
  UNIQUE (from_entry_id, to_entry_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_entry_links_from
  ON entry_links (from_entry_id);

CREATE INDEX IF NOT EXISTS idx_entry_links_to
  ON entry_links (to_entry_id);

CREATE TABLE IF NOT EXISTS appointments (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS appointment_reminders (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
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

INSERT OR IGNORE INTO _migrations (id, applied_at)
VALUES ('0001_init.sql', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT OR IGNORE INTO _migrations (id, applied_at)
VALUES ('0002_knowledge.sql', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT OR IGNORE INTO _migrations (id, applied_at)
VALUES ('0003_appointments.sql', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT OR IGNORE INTO _migrations (id, applied_at)
VALUES ('0004_appointment_reminders.sql', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT OR IGNORE INTO _migrations (id, applied_at)
VALUES ('0005_multitenancy.sql', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT OR IGNORE INTO _migrations (id, applied_at)
VALUES ('0006_tenant_preferences.sql', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT OR IGNORE INTO _migrations (id, applied_at)
VALUES ('0007_all_appointment_reminders.sql', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
