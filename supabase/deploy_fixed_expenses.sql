-- ==============================================================================
-- MIGRACIÓN SUPABASE: TABLA DE GASTOS FIJOS MENSUALES (fixed_expenses)
-- Ejecutar en el SQL Editor de Supabase (tanto en DEV como en PRODUCCIÓN)
-- ==============================================================================

BEGIN;

-- 1. Crear tabla de Gastos Fijos
CREATE TABLE IF NOT EXISTS public.fixed_expenses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    expected_amount NUMERIC NOT NULL CHECK (expected_amount >= 0),
    person TEXT NOT NULL DEFAULT 'Compartido',
    due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31),
    status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Habilitar RLS
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas RLS permisivas para anon y authenticated
DROP POLICY IF EXISTS "app_access_fixed_expenses" ON public.fixed_expenses;
CREATE POLICY "app_access_fixed_expenses" 
ON public.fixed_expenses 
FOR ALL TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- 4. Publicación Realtime (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'fixed_expenses'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.fixed_expenses;
    END IF;
END $$;

-- 5. Recargar esquema PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
