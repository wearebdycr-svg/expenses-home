-- ==============================================================================
-- EXPENSES HOME: MIGRACIÓN DEFINITIVA DE BASE DE DATOS Y RLS COMPLETO
-- Ejecutar este script en el SQL Editor de Supabase (PRODUCCIÓN y DESARROLLO)
-- Desbloquea permisos de lectura y escritura para TODAS las tablas de la app
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. TABLA: public.persons
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.persons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.persons (id, name, color) VALUES
  ('benny', 'Benny', '#3B82F6'),
  ('charlie', 'Charlie', '#F59E0B'),
  ('compartido', 'Compartido', '#10B981')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_persons" ON public.persons;
DROP POLICY IF EXISTS "Solo autenticados pueden ver personas" ON public.persons;
DROP POLICY IF EXISTS "Permitir acceso completo a personas" ON public.persons;
CREATE POLICY "app_access_persons" ON public.persons FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 2. TABLA: public.expenses (Gastos Diarios)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  person TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  currency TEXT DEFAULT 'COP',
  amount_usd NUMERIC,
  exchange_rate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'COP';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS amount_usd NUMERIC;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_expenses" ON public.expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden ver gastos" ON public.expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden crear gastos" ON public.expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar gastos" ON public.expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar gastos" ON public.expenses;
CREATE POLICY "app_access_expenses" ON public.expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 3. TABLA: public.incomes (Ingresos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  person TEXT NOT NULL,
  source TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_incomes" ON public.incomes;
DROP POLICY IF EXISTS "Solo autenticados pueden ver ingresos" ON public.incomes;
DROP POLICY IF EXISTS "Solo autenticados pueden crear ingresos" ON public.incomes;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar ingresos" ON public.incomes;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar ingresos" ON public.incomes;
CREATE POLICY "app_access_incomes" ON public.incomes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 4. TABLA: public.debts (Deudas y Créditos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  person TEXT NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  original_amount NUMERIC NOT NULL,
  current_balance NUMERIC NOT NULL,
  monthly_payment NUMERIC NOT NULL,
  annual_interest_rate NUMERIC NOT NULL,
  total_months NUMERIC,
  color TEXT,
  status TEXT NOT NULL DEFAULT 'activa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS total_months NUMERIC;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'activa';

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_debts" ON public.debts;
DROP POLICY IF EXISTS "Solo autenticados pueden ver deudas" ON public.debts;
DROP POLICY IF EXISTS "Solo autenticados pueden crear deudas" ON public.debts;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar deudas" ON public.debts;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar deudas" ON public.debts;
DROP POLICY IF EXISTS "Permitir lectura de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir insercion de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir actualizacion de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir eliminacion de debts" ON public.debts;
CREATE POLICY "app_access_debts" ON public.debts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 5. TABLA: public.tc_cards (Tarjetas de Crédito)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tc_cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bank TEXT NOT NULL,
  last_digits TEXT DEFAULT '',
  person TEXT NOT NULL,
  theme_id TEXT DEFAULT 'emerald',
  color TEXT NOT NULL,
  gradient TEXT NOT NULL,
  quota NUMERIC,
  payment_category TEXT DEFAULT 'TC-compartida',
  is_default BOOLEAN DEFAULT false,
  description TEXT,
  status TEXT DEFAULT 'activa',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tc_cards ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'activa';

ALTER TABLE public.tc_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_tc_cards" ON public.tc_cards;
DROP POLICY IF EXISTS "Solo autenticados pueden ver tc_cards" ON public.tc_cards;
DROP POLICY IF EXISTS "Solo autenticados pueden crear tc_cards" ON public.tc_cards;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar tc_cards" ON public.tc_cards;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar tc_cards" ON public.tc_cards;
CREATE POLICY "app_access_tc_cards" ON public.tc_cards FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 6. TABLA: public.tc_expenses (Consumos de Tarjetas de Crédito)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tc_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  person TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  card_id TEXT,
  currency TEXT DEFAULT 'COP',
  amount_usd NUMERIC,
  exchange_rate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tc_expenses ADD COLUMN IF NOT EXISTS card_id TEXT;
ALTER TABLE public.tc_expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'COP';
ALTER TABLE public.tc_expenses ADD COLUMN IF NOT EXISTS amount_usd NUMERIC;
ALTER TABLE public.tc_expenses ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

ALTER TABLE public.tc_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden ver tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden crear tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar tc_expenses" ON public.tc_expenses;
CREATE POLICY "app_access_tc_expenses" ON public.tc_expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 7. TABLA: public.projects & public.project_expenses (Proyectos y Eventos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  budget_amount NUMERIC NOT NULL CHECK (budget_amount > 0),
  person TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🎯',
  color TEXT NOT NULL DEFAULT '#3B82F6',
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'activo',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.project_expenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  person TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  currency TEXT DEFAULT 'COP',
  amount_usd NUMERIC,
  exchange_rate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.project_expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'COP';
ALTER TABLE public.project_expenses ADD COLUMN IF NOT EXISTS amount_usd NUMERIC;
ALTER TABLE public.project_expenses ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_projects" ON public.projects;
DROP POLICY IF EXISTS "Solo autenticados pueden ver projects" ON public.projects;
DROP POLICY IF EXISTS "Solo autenticados pueden crear projects" ON public.projects;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar projects" ON public.projects;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar projects" ON public.projects;
CREATE POLICY "app_access_projects" ON public.projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_project_expenses" ON public.project_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden ver project_expenses" ON public.project_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden crear project_expenses" ON public.project_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar project_expenses" ON public.project_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar project_expenses" ON public.project_expenses;
CREATE POLICY "app_access_project_expenses" ON public.project_expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 8. TABLA: public.category_budgets (Topes Presupuestales Mensuales)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.category_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_category_budgets" ON public.category_budgets;
CREATE POLICY "app_access_category_budgets" ON public.category_budgets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 9. TABLA: public.fcm_tokens (Notificaciones Push Web / Móvil)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  person TEXT NOT NULL DEFAULT 'Hogar',
  household_id TEXT DEFAULT 'family-home',
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_fcm_tokens" ON public.fcm_tokens;
CREATE POLICY "app_access_fcm_tokens" ON public.fcm_tokens FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 10. TABLA: public.app_users (Usuarios y accesos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_app_users" ON public.app_users;
CREATE POLICY "app_access_app_users" ON public.app_users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 11. VISTA: public.v_monthly_summary (Consolidado de Resumen Mensual)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_monthly_summary AS
WITH months_incomes AS (
  SELECT
    EXTRACT(YEAR FROM date)::int AS year,
    EXTRACT(MONTH FROM date)::int AS month,
    COALESCE(SUM(CASE WHEN person = 'Benny' THEN amount ELSE 0 END), 0) AS income_benny,
    COALESCE(SUM(CASE WHEN person = 'Charlie' THEN amount ELSE 0 END), 0) AS income_charlie,
    COALESCE(SUM(amount), 0) AS total_income
  FROM public.incomes
  GROUP BY 1, 2
),
months_expenses AS (
  SELECT
    EXTRACT(YEAR FROM date)::int AS year,
    EXTRACT(MONTH FROM date)::int AS month,
    COALESCE(SUM(CASE WHEN person = 'Benny' THEN amount ELSE 0 END), 0) AS expense_benny,
    COALESCE(SUM(CASE WHEN person = 'Charlie' THEN amount ELSE 0 END), 0) AS expense_charlie,
    COALESCE(SUM(CASE WHEN person = 'Compartido' THEN amount ELSE 0 END), 0) AS expense_compartido,
    COALESCE(SUM(amount), 0) AS total_expense
  FROM public.expenses
  GROUP BY 1, 2
),
all_periods AS (
  SELECT year, month FROM months_incomes
  UNION
  SELECT year, month FROM months_expenses
)
SELECT
  p.year,
  p.month,
  COALESCE(i.income_benny, 0)::numeric AS income_benny,
  COALESCE(i.income_charlie, 0)::numeric AS income_charlie,
  COALESCE(i.total_income, 0)::numeric AS total_income,
  COALESCE(e.expense_benny, 0)::numeric AS expense_benny,
  COALESCE(e.expense_charlie, 0)::numeric AS expense_charlie,
  COALESCE(e.expense_compartido, 0)::numeric AS expense_compartido,
  COALESCE(e.total_expense, 0)::numeric AS total_expense,
  (COALESCE(i.total_income, 0) - COALESCE(e.total_expense, 0))::numeric AS balance,
  CASE 
    WHEN COALESCE(i.total_income, 0) > 0 
    THEN ROUND(((COALESCE(i.total_income, 0) - COALESCE(e.total_expense, 0)) / COALESCE(i.total_income, 0)) * 100, 2)::numeric
    ELSE 0::numeric
  END AS savings_rate
FROM all_periods p
LEFT JOIN months_incomes i ON p.year = i.year AND p.month = i.month
LEFT JOIN months_expenses e ON p.year = e.year AND p.month = e.month
ORDER BY p.year, p.month;

GRANT SELECT ON public.v_monthly_summary TO anon, authenticated;


-- ------------------------------------------------------------------------------
-- 12. HABILITAR REALTIME (Para actualización instantánea entre dispositivos)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.debts;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tc_cards;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.project_expenses;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.category_budgets;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMIT;
