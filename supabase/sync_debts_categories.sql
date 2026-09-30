-- ==============================================================================
-- Migración: Sincronización Dinámica de Deudas y Categorías de Gastos
-- Ejecutar en el SQL Editor de Supabase (DEV y Producción)
-- ==============================================================================

BEGIN;

-- 1. Eliminar la restricción fija de categorías en expenses para permitir
--    que las deudas activas funcionen como categorías dinámicas de amortización
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- 2. Asegurar la columna 'status' en la tabla de deudas ('activa' | 'saldada')
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'activa';

COMMIT;
