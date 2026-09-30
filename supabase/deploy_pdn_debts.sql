-- ==============================================================================
-- SCRIPT DE DESPLIEGUE A PRODUCCIÓN (PDN): MÓDULO DE DEUDAS Y PROYECCIÓN
-- Totalmente idempotente, no destructivo y transaccional (BEGIN...COMMIT)
-- Ejecutar en el SQL Editor de Supabase en el proyecto de PRODUCCIÓN (expenses-home-pdn)
-- ==============================================================================

BEGIN;

-- 1. Crear tabla de deudas si aún no existe
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  person TEXT NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  original_amount NUMERIC NOT NULL,
  current_balance NUMERIC NOT NULL,
  monthly_payment NUMERIC NOT NULL,
  annual_interest_rate NUMERIC NOT NULL,
  color TEXT,
  status TEXT NOT NULL DEFAULT 'activa',
  total_months INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Asegurar que todas las columnas nuevas existan si la tabla ya había sido creada previamente
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS start_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'activa';
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS total_months INTEGER;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS color TEXT;

-- 3. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- 4. Limpiar y recrear políticas RLS para lectura y escritura (anon y authenticated)
DROP POLICY IF EXISTS "Permitir lectura publica de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir insercion publica de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir actualizacion publica de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir eliminacion publica de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir lectura de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir insercion de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir actualizacion de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir eliminacion de debts" ON public.debts;

CREATE POLICY "Permitir lectura de debts"
ON public.debts FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Permitir insercion de debts"
ON public.debts FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Permitir actualizacion de debts"
ON public.debts FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Permitir eliminacion de debts"
ON public.debts FOR DELETE TO anon, authenticated USING (true);

-- 5. Habilitar sincronización en tiempo real (Realtime)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'debts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.debts;
    END IF;
END $$;

-- 6. Asegurar que los pagos de amortización a deudas puedan registrarse en expenses sin restricción fija
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

COMMIT;
