CREATE TABLE files (
  file_id        SERIAL       PRIMARY KEY,
  task_id        INT          NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  user_id        INT          NOT NULL REFERENCES users(user_id),
  stored_name    VARCHAR(255) NOT NULL,
  original_name  VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(100) NOT NULL,
  file_size      BIGINT       NOT NULL,
  uploaded_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
