-- Segundo cérebro: projetos, entradas de conhecimento e vínculos.
-- Tarefas continuam em `tasks`; projetos e entradas são camadas novas.

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS entry_links (
  id            TEXT PRIMARY KEY,
  from_entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  to_entry_id   TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  relation      TEXT NOT NULL DEFAULT 'related',
  created_at    TEXT NOT NULL,
  UNIQUE (from_entry_id, to_entry_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_entry_links_from
  ON entry_links (from_entry_id);

CREATE INDEX IF NOT EXISTS idx_entry_links_to
  ON entry_links (to_entry_id);

-- Tarefas podem pertencer a um projeto e/ou nascer de uma entrada.
ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN entry_id TEXT REFERENCES entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project
  ON tasks (project_id, status);
