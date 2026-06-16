-- Add project limit to plans (default 5 for all existing plans)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_projects INT NOT NULL DEFAULT 5;

-- Projects scoped to a group
CREATE TABLE IF NOT EXISTS projects (
  project_id   SERIAL        PRIMARY KEY,
  group_id     INT           NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  project_name VARCHAR(255)  NOT NULL,
  start_date   DATE          NOT NULL,
  end_date     DATE          NOT NULL,
  created_by   INT           NOT NULL REFERENCES users(user_id),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT projects_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_projects_group ON projects(group_id);

-- Which users are assigned to which project
CREATE TABLE IF NOT EXISTS project_members (
  project_id  INT  NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  user_id     INT  NOT NULL REFERENCES users(user_id)       ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

-- One log entry per user per project per day
CREATE TABLE IF NOT EXISTS daily_logs (
  log_id      SERIAL       PRIMARY KEY,
  project_id  INT          NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  user_id     INT          NOT NULL REFERENCES users(user_id)       ON DELETE CASCADE,
  log_date    DATE         NOT NULL,
  content     TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_project ON daily_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user    ON daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date    ON daily_logs(log_date);

-- Auto-update updated_at on daily_logs
CREATE OR REPLACE FUNCTION update_daily_log_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_logs_updated_at ON daily_logs;
CREATE TRIGGER daily_logs_updated_at
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_daily_log_timestamp();
