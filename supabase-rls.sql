-- ============================================================
-- EMMA Dashboard — Supabase RLS Policies
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── 0. Create tables if they don't exist yet ───────────────

CREATE TABLE IF NOT EXISTS threshold_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL UNIQUE CHECK (scope IN ('overview', 'revenue', 'branch', 'procedure')),
  minimum_gp_margin_pct numeric(5,2),
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branch_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name  text NOT NULL,
  data       jsonb NOT NULL,
  year       int,
  uploaded_at timestamptz DEFAULT now()
);

-- ─── 1. Enable RLS on all tables ────────────────────────────

ALTER TABLE monthly_reports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE threshold_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_reports      ENABLE ROW LEVEL SECURITY;

-- ─── 2. Revoke open access granted in previous setup ────────

REVOKE ALL ON TABLE monthly_reports     FROM anon;
REVOKE ALL ON TABLE company_comparisons FROM anon;
REVOKE ALL ON TABLE threshold_settings  FROM anon;

-- ─── 3. Grant access to authenticated role only ─────────────

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL   ON TABLE monthly_reports     TO authenticated;
GRANT ALL   ON TABLE company_comparisons TO authenticated;
GRANT ALL   ON TABLE threshold_settings  TO authenticated;
GRANT ALL   ON TABLE branch_reports      TO authenticated;

-- ─── 4. Drop old policies if they exist (safe re-run) ────────

DROP POLICY IF EXISTS "authenticated read monthly_reports"     ON monthly_reports;
DROP POLICY IF EXISTS "authenticated insert monthly_reports"   ON monthly_reports;
DROP POLICY IF EXISTS "authenticated delete monthly_reports"   ON monthly_reports;
DROP POLICY IF EXISTS "authenticated read company_comparisons" ON company_comparisons;
DROP POLICY IF EXISTS "authenticated write company_comparisons" ON company_comparisons;
DROP POLICY IF EXISTS "authenticated update company_comparisons" ON company_comparisons;
DROP POLICY IF EXISTS "authenticated delete company_comparisons" ON company_comparisons;
DROP POLICY IF EXISTS "authenticated read threshold_settings"  ON threshold_settings;
DROP POLICY IF EXISTS "authenticated write threshold_settings" ON threshold_settings;
DROP POLICY IF EXISTS "authenticated update threshold_settings" ON threshold_settings;
DROP POLICY IF EXISTS "authenticated read branch_reports"      ON branch_reports;
DROP POLICY IF EXISTS "authenticated insert branch_reports"    ON branch_reports;
DROP POLICY IF EXISTS "authenticated delete branch_reports"    ON branch_reports;

-- ─── 5. Create RLS Policies ──────────────────────────────────

-- monthly_reports
CREATE POLICY "authenticated read monthly_reports"
  ON monthly_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated insert monthly_reports"
  ON monthly_reports FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated delete monthly_reports"
  ON monthly_reports FOR DELETE TO authenticated USING (true);

-- company_comparisons
CREATE POLICY "authenticated read company_comparisons"
  ON company_comparisons FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated write company_comparisons"
  ON company_comparisons FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated update company_comparisons"
  ON company_comparisons FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated delete company_comparisons"
  ON company_comparisons FOR DELETE TO authenticated USING (true);

-- threshold_settings
CREATE POLICY "authenticated read threshold_settings"
  ON threshold_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated write threshold_settings"
  ON threshold_settings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated update threshold_settings"
  ON threshold_settings FOR UPDATE TO authenticated USING (true);

-- branch_reports
CREATE POLICY "authenticated read branch_reports"
  ON branch_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated insert branch_reports"
  ON branch_reports FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated delete branch_reports"
  ON branch_reports FOR DELETE TO authenticated USING (true);

-- ─── Done ────────────────────────────────────────────────────
-- Next step: Authentication → Users → Invite user
-- Email: Chairuek.ng@emmaclinicthailand.com
