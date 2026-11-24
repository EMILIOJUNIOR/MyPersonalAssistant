ALTER TABLE projects ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '1357657470';
ALTER TABLE entries ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '1357657470';
ALTER TABLE tasks ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '1357657470';
ALTER TABLE reminders ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '1357657470';
ALTER TABLE appointments ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '1357657470';
ALTER TABLE appointment_reminders ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '1357657470';

CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects (tenant_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_entries_tenant ON entries (tenant_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks (tenant_id, due_at);
CREATE INDEX IF NOT EXISTS idx_reminders_tenant ON reminders (tenant_id, remind_at);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments (tenant_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_tenant ON appointment_reminders (tenant_id, remind_at);
