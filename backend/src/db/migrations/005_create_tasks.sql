CREATE TABLE tasks (
  task_id      SERIAL       PRIMARY KEY,
  user_id      INT          NOT NULL REFERENCES users(user_id),
  group_id     INT          NOT NULL REFERENCES groups(group_id),
  created_by   INT          NOT NULL REFERENCES users(user_id),
  task_name    VARCHAR(255) NOT NULL,
  task_details TEXT,
  task_report  TEXT,
  status       VARCHAR(20)  NOT NULL DEFAULT 'not_started'
                            CHECK (status IN ('not_started', 'in_progress', 'completed')),
  start_date   DATE         NOT NULL,
  end_date     DATE         NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
