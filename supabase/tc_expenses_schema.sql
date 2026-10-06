-- ==============================================================================
-- Tabla de Consumos TC Compartida (tc_expenses)
-- Para registrar consumos directos realizados con la tarjeta de crédito compartida
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.tc_expenses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date DATE NOT NULL,
    person TEXT NOT NULL REFERENCES public.persons(name) ON UPDATE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    category TEXT DEFAULT 'General',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.tc_expenses ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para lectura y escritura (anon y authenticated)
CREATE POLICY "Permitir lectura de tc_expenses"
ON public.tc_expenses
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir insercion de tc_expenses"
ON public.tc_expenses
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Permitir actualizacion de tc_expenses"
ON public.tc_expenses
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Permitir eliminacion de tc_expenses"
ON public.tc_expenses
FOR DELETE
TO authenticated
USING (true);

-- Habilitar Replicación en Tiempo Real (Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tc_expenses;
