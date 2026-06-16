CREATE TABLE plans (
  plan_id    SERIAL          PRIMARY KEY,
  plan_name  VARCHAR(100)    NOT NULL,
  max_user   INT             NOT NULL,
  price      NUMERIC(10, 2)  NOT NULL
);
