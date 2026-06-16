CREATE TABLE groups (
  group_id    SERIAL       PRIMARY KEY,
  group_name  VARCHAR(255) NOT NULL,
  plan_id     INT          NOT NULL REFERENCES plans(plan_id),
  type        VARCHAR(20)  NOT NULL CHECK (type IN ('company', 'personal')),
  status      VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
