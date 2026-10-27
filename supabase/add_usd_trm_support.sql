-- ==============================================================================
-- MIGRACIÓN SUPABASE: SOPORTE DE DÓLARES (USD) Y TRM
-- Agrega columnas para registrar moneda original, monto en USD y tasa de cambio.
-- Totalmente idempotente y seguro de ejecutar en DEV y PRODUCCIÓN.
-- ==============================================================================

BEGIN;

-- 1. Soporte en project_expenses
ALTER TABLE public.project_expenses 
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'COP',
    ADD COLUMN IF NOT EXISTS amount_usd NUMERIC,
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

-- 2. Soporte en tc_expenses
ALTER TABLE public.tc_expenses 
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'COP',
    ADD COLUMN IF NOT EXISTS amount_usd NUMERIC,
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

COMMIT;
