-- ==============================================================================
-- Migración: Añadir campo total_months (número de meses) a la tabla debts
-- Ejecutar en Supabase SQL Editor (DEV y Producción)
-- ==============================================================================

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS total_months INTEGER;
