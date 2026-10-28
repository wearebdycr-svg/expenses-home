-- ==============================================================================
-- Tabla de Topes Presupuestales Mensuales por Categoría (category_budgets)
-- Permite que los límites presupuestales configurados por la familia
-- se sincronicen en tiempo real en todos los dispositivos (esposa, esposo, web).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.category_budgets (
    category TEXT PRIMARY KEY,
    amount NUMERIC NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
DROP POLICY IF EXISTS "Solo autenticados pueden ver category_budgets" ON public.category_budgets;
DROP POLICY IF EXISTS "Solo autenticados pueden insertar category_budgets" ON public.category_budgets;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar category_budgets" ON public.category_budgets;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar category_budgets" ON public.category_budgets;

CREATE POLICY "Solo autenticados pueden ver category_budgets"
ON public.category_budgets FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Solo autenticados pueden insertar category_budgets"
ON public.category_budgets FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden actualizar category_budgets"
ON public.category_budgets FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden eliminar category_budgets"
ON public.category_budgets FOR DELETE
TO authenticated
USING (true);
