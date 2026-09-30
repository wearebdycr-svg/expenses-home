-- ==============================================================================
-- Script Completo: Configuración de TC Compartida y Conciliación
-- Ejecutar en el SQL Editor de Supabase (Primero en DEV, luego en PROD si aplica)
-- ==============================================================================

-- 1. Actualizar la restricción de categorías en public.expenses para incluir 'TC-compartida'
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check CHECK (category IN (
    'Alimentación',
    'Transporte',
    'Salud',
    'Entretenimiento',
    'Educación',
    'Ropa',
    'Tecnología',
    'Restaurantes',
    'Cuidado Personal',
    'Hogar',
    'Servicios',
    'Ahorro / Inversión',
    'TC-compartida',
    'Otros'
));

-- 2. Crear la tabla de consumos directos de la Tarjeta de Crédito (public.tc_expenses)
CREATE TABLE IF NOT EXISTS public.tc_expenses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date DATE NOT NULL,
    person TEXT NOT NULL REFERENCES public.persons(name) ON UPDATE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    category TEXT DEFAULT 'General',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Habilitar Seguridad a Nivel de Fila (RLS) para tc_expenses
ALTER TABLE public.tc_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de tc_expenses"
ON public.tc_expenses FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Permitir insercion de tc_expenses"
ON public.tc_expenses FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Permitir actualizacion de tc_expenses"
ON public.tc_expenses FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Permitir eliminacion de tc_expenses"
ON public.tc_expenses FOR DELETE TO anon, authenticated USING (true);

-- 4. Habilitar Tiempo Real (Realtime) para sincronización automática
ALTER PUBLICATION supabase_realtime ADD TABLE public.tc_expenses;
