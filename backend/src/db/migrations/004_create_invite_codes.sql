CREATE TABLE invite_codes (
  code_id     SERIAL       PRIMARY KEY,
  group_id    INT          NOT NULL REFERENCES groups(group_id),
  created_by  INT          NOT NULL REFERENCES users(user_id),
  code_hash   VARCHAR(255) NOT NULL,
  is_used     BOOLEAN      NOT NULL DEFAULT FALSE,
  used_by     INT          REFERENCES users(user_id),
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
