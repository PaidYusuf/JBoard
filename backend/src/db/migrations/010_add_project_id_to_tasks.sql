ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id INT REFERENCES projects(project_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
