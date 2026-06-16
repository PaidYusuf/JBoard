CREATE TABLE logs (
  log_id    SERIAL       PRIMARY KEY,
  user_id   INT          REFERENCES users(user_id) ON DELETE SET NULL,
  log_type  VARCHAR(50)  NOT NULL,
  action    TEXT         NOT NULL,
  timestamp TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Required indexes from the spec (Section 2.2 performance note)
CREATE INDEX idx_logs_log_type  ON logs(log_type);
CREATE INDEX idx_logs_timestamp ON logs(timestamp);
