-- ==============================================================================
-- Tabla de Proyectos & Eventos y sus Gastos Asociados
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    budget_amount NUMERIC NOT NULL CHECK (budget_amount > 0),
    person TEXT NOT NULL REFERENCES public.persons(name) ON UPDATE CASCADE,
    icon TEXT NOT NULL DEFAULT '🎯',
    color TEXT NOT NULL DEFAULT '#3B82F6',
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'completado', 'archivado')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.project_expenses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    person TEXT NOT NULL REFERENCES public.persons(name) ON UPDATE CASCADE,
    category TEXT DEFAULT 'General',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo autenticados pueden ver projects"
ON public.projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo autenticados pueden crear projects"
ON public.projects FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden actualizar projects"
ON public.projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden eliminar projects"
ON public.projects FOR DELETE TO authenticated USING (true);

CREATE POLICY "Solo autenticados pueden ver project_expenses"
ON public.project_expenses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo autenticados pueden crear project_expenses"
ON public.project_expenses FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden actualizar project_expenses"
ON public.project_expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden eliminar project_expenses"
ON public.project_expenses FOR DELETE TO authenticated USING (true);
