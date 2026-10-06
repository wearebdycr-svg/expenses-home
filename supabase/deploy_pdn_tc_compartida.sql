-- ==============================================================================
-- SCRIPT DE DESPLIEGUE A PRODUCCIÓN (PDN): TC COMPARTIDA Y CATEGORÍAS OFICIALES
-- Totalmente idempotente, no destructivo y transaccional (BEGIN...COMMIT)
-- Ejecutar en el SQL Editor de Supabase en el proyecto de PRODUCCIÓN
-- ==============================================================================

BEGIN;

-- 1. Asegurar que la persona 'Compartido' exista en la tabla de personas
INSERT INTO public.persons (id, name, color)
VALUES ('compartido', 'Compartido', '#10B981')
ON CONFLICT (id) DO UPDATE SET color = EXCLUDED.color;

-- 2. Eliminar restricción antigua de categorías temporalmente para migrar datos
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- 3. Homologar categorías existentes en PDN a las 15 categorías oficiales
UPDATE public.expenses SET category = 'Mercado' WHERE category = 'Alimentación';
UPDATE public.expenses SET category = 'Entretenimiento/salidas' WHERE category IN ('Restaurantes', 'Entretenimiento');
UPDATE public.expenses SET category = 'Servicios públicos' WHERE category = 'Servicios';
UPDATE public.expenses SET category = 'Compras' WHERE category IN ('Ropa', 'Tecnología');
UPDATE public.expenses SET category = 'Salud' WHERE category = 'Cuidado Personal';
UPDATE public.expenses SET category = 'Ahorro/inversión' WHERE category = 'Ahorro / Inversión';

-- Cualquier otra categoría legada no reconocida se clasifica como 'Otros'
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

-- 4. Aplicar restricción con las 15 categorías oficiales
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

-- 5. Crear tabla para los consumos de la TC compartida (si no existe)
CREATE TABLE IF NOT EXISTS public.tc_expenses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date DATE NOT NULL,
    person TEXT NOT NULL REFERENCES public.persons(name) ON UPDATE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    category TEXT DEFAULT 'General',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. Habilitar Seguridad a Nivel de Fila (RLS) en tc_expenses
ALTER TABLE public.tc_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Permitir insercion de tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Permitir actualizacion de tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Permitir eliminacion de tc_expenses" ON public.tc_expenses;

CREATE POLICY "Permitir lectura de tc_expenses"
ON public.tc_expenses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir insercion de tc_expenses"
ON public.tc_expenses FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir actualizacion de tc_expenses"
ON public.tc_expenses FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Permitir eliminacion de tc_expenses"
ON public.tc_expenses FOR DELETE TO authenticated USING (true);

-- 7. Habilitar sincronización en tiempo real (Realtime)
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

-- 8. Migrar gastos que estaban en expenses como 'Compartido' hacia tc_expenses
INSERT INTO public.tc_expenses (id, date, person, description, amount, category, created_at)
SELECT 
    id::text, 
    date, 
    person, 
    description, 
    amount, 
    category, 
    created_at
FROM public.expenses
WHERE person = 'Compartido'
ON CONFLICT (id) DO UPDATE 
SET 
    date = EXCLUDED.date,
    person = EXCLUDED.person,
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    category = EXCLUDED.category;

-- 9. Eliminar de expenses los gastos compartidos para que no aparezcan en Gastos Diarios
DELETE FROM public.expenses
WHERE person = 'Compartido';

COMMIT;
