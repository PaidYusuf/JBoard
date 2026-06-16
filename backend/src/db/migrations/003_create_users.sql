CREATE TABLE users (
  user_id             SERIAL       PRIMARY KEY,
  group_id            INT          REFERENCES groups(group_id),
  email               VARCHAR(255) NOT NULL UNIQUE,
  password_hash       VARCHAR(255) NOT NULL,
  fname               VARCHAR(100) NOT NULL,
  lname               VARCHAR(100) NOT NULL,
  role                VARCHAR(20)  NOT NULL CHECK (role IN ('superadmin', 'admin', 'user')),
  account_type        VARCHAR(20)  NOT NULL CHECK (account_type IN ('company', 'solo')),
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login          TIMESTAMPTZ,
  session_token       VARCHAR(255),
  session_expires_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
