-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- Table: monthly P&L reports (one row per upload, historical)
CREATE TABLE IF NOT EXISTS monthly_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name  text NOT NULL,
  data       jsonb NOT NULL,
  year       int,
  uploaded_at timestamptz DEFAULT now()
);

-- Table: industry comparison data (one row per company, upserted)
CREATE TABLE IF NOT EXISTS company_comparisons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  text NOT NULL UNIQUE,
  name        text NOT NULL,
  year        int,
  file_name   text,
  metrics     jsonb NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

-- Table: dashboard threshold overrides (optional global config)
CREATE TABLE IF NOT EXISTS threshold_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL UNIQUE CHECK (scope IN ('overview', 'revenue', 'branch', 'procedure')),
  minimum_gp_margin_pct numeric(5,2),
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- Grant access to anon role (no auth required)
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON TABLE monthly_reports TO anon;
GRANT ALL ON TABLE company_comparisons TO anon;
GRANT ALL ON TABLE threshold_settings TO anon;
