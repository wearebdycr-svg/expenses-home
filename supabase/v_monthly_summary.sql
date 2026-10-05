-- ==============================================================================
-- EXPENSES-HOME: Vista SQL de Resumen Mensual (Fase 2 de Desacople)
-- ==============================================================================
-- Fecha: 2026-10-05
-- Descripción:
-- Esta vista consolida automáticamente los ingresos y gastos mensuales por persona:
--   - Ingresos de Benny, Charlie y Total
--   - Gastos de Benny, Charlie, Compartido y Total
--   - Balance neto mensual
--   - Tasa de ahorro porcentual
--
-- Evita que el cliente móvil tenga que descargar miles de filas crudas y ejecutar
-- bucles en JavaScript. PostgreSQL calcula el consolidado en sub-milisegundos.
-- ==============================================================================

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

-- Otorgar permisos de consulta para el cliente Supabase
GRANT SELECT ON public.v_monthly_summary TO anon, authenticated;
