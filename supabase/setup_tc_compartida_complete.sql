-- ==============================================================================
-- Script Definitivo: Migración de Categorías Existentes y Creación de TC Compartida
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

-- PASO 1: Eliminar la restricción antigua de categorías para poder actualizar
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- PASO 2: Homologar y actualizar los registros existentes a las 15 nuevas categorías
UPDATE public.expenses SET category = 'Mercado' WHERE category = 'Alimentación';
UPDATE public.expenses SET category = 'Entretenimiento/salidas' WHERE category IN ('Restaurantes', 'Entretenimiento');
UPDATE public.expenses SET category = 'Servicios públicos' WHERE category = 'Servicios';
UPDATE public.expenses SET category = 'Compras' WHERE category IN ('Ropa', 'Tecnología');
UPDATE public.expenses SET category = 'Salud' WHERE category = 'Cuidado Personal';
UPDATE public.expenses SET category = 'Ahorro/inversión' WHERE category = 'Ahorro / Inversión';

-- Cualquier otra categoría anterior no contemplada se asigna a 'Otros'
UPDATE public.expenses 
SET category = 'Otros' 
WHERE category NOT IN (
    'Ahorro/inversión',
    'Compras',
    'Deudas',
    'Educación',
    'Entretenimiento/salidas',
    'Hogar',
    'Mercado',
    'Otros',
    'Regalos',
    'Salud',
    'Servicios públicos',
    'Suscripciones',
    'Transporte',
    'Viajes',
    'TC-compartida'
);

-- PASO 3: Aplicar la nueva restricción con las 15 categorías oficiales
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check CHECK (category IN (
    'Ahorro/inversión',
    'Compras',
    'Deudas',
    'Educación',
    'Entretenimiento/salidas',
    'Hogar',
    'Mercado',
    'Otros',
    'Regalos',
    'Salud',
    'Servicios públicos',
    'Suscripciones',
    'Transporte',
    'Viajes',
    'TC-compartida'
));

-- PASO 4: CREACIÓN DE LA TABLA PARA LA TC COMPARTIDA (public.tc_expenses)
CREATE TABLE IF NOT EXISTS public.tc_expenses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date DATE NOT NULL,
    person TEXT NOT NULL REFERENCES public.persons(name) ON UPDATE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    category TEXT DEFAULT 'General',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- PASO 5: Habilitar Seguridad a Nivel de Fila (RLS) en la tabla tc_expenses
ALTER TABLE public.tc_expenses ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Permitir lectura de tc_expenses" ON public.tc_expenses;
    DROP POLICY IF EXISTS "Permitir insercion de tc_expenses" ON public.tc_expenses;
    DROP POLICY IF EXISTS "Permitir actualizacion de tc_expenses" ON public.tc_expenses;
    DROP POLICY IF EXISTS "Permitir eliminacion de tc_expenses" ON public.tc_expenses;
END $$;

CREATE POLICY "Permitir lectura de tc_expenses"
ON public.tc_expenses FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Permitir insercion de tc_expenses"
ON public.tc_expenses FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Permitir actualizacion de tc_expenses"
ON public.tc_expenses FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Permitir eliminacion de tc_expenses"
ON public.tc_expenses FOR DELETE TO anon, authenticated USING (true);

-- PASO 6: Habilitar Tiempo Real (Realtime) para sincronización automática
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'tc_expenses'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tc_expenses;
    END IF;
END $$;
