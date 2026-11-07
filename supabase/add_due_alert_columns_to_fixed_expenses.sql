-- ==============================================================================
-- MIGRACIÓN SUPABASE: ADICIÓN DE COLUMNAS DE ALERTA A GASTOS FIJOS (fixed_expenses)
-- Ejecutar en el SQL Editor de Supabase (tanto en DEV como en PRODUCCIÓN)
-- ==============================================================================

BEGIN;

-- 1. Añadir columnas dia_limite_mes y dias_anticipacion_alerta si no existen
ALTER TABLE public.fixed_expenses 
    ADD COLUMN IF NOT EXISTS dia_limite_mes INTEGER CHECK (dia_limite_mes >= 1 AND dia_limite_mes <= 31),
    ADD COLUMN IF NOT EXISTS dias_anticipacion_alerta INTEGER DEFAULT 3 CHECK (dias_anticipacion_alerta >= 0);

-- 2. Migrar datos existentes desde due_day hacia dia_limite_mes
UPDATE public.fixed_expenses 
SET dia_limite_mes = due_day 
WHERE dia_limite_mes IS NULL AND due_day IS NOT NULL;

-- 3. Establecer valor por defecto para registros sin anticipación
UPDATE public.fixed_expenses 
SET dias_anticipacion_alerta = 3 
WHERE dias_anticipacion_alerta IS NULL;

-- 4. Recargar esquema PostgREST en Supabase
NOTIFY pgrst, 'reload schema';

COMMIT;
