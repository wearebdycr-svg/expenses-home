-- ==============================================================================
-- FIX DEFINITIVO: RLS EN PROYECTOS, SOPORTE USD/TRM, USUARIOS Y RECUPERACIÓN DE EVENTO
-- Ejecutar en el SQL Editor de Supabase (una sola vez)
-- ==============================================================================

BEGIN;

-- 1. DESBLOQUEAR RLS EN PROYECTOS Y GASTOS DE PROYECTOS (Permitir a anon y authenticated)
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Solo autenticados pueden ver projects" ON public.projects;
DROP POLICY IF EXISTS "Solo autenticados pueden crear projects" ON public.projects;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar projects" ON public.projects;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar projects" ON public.projects;
DROP POLICY IF EXISTS "app_access_projects" ON public.projects;

CREATE POLICY "app_access_projects" ON public.projects
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

ALTER TABLE IF EXISTS public.project_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Solo autenticados pueden ver project_expenses" ON public.project_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden crear project_expenses" ON public.project_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar project_expenses" ON public.project_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar project_expenses" ON public.project_expenses;
DROP POLICY IF EXISTS "app_access_project_expenses" ON public.project_expenses;

CREATE POLICY "app_access_project_expenses" ON public.project_expenses
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 2. SOPORTE DE COLUMNAS USD Y TRM
ALTER TABLE IF EXISTS public.project_expenses 
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'COP',
    ADD COLUMN IF NOT EXISTS amount_usd NUMERIC,
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

ALTER TABLE IF EXISTS public.tc_expenses 
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'COP',
    ADD COLUMN IF NOT EXISTS amount_usd NUMERIC,
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

ALTER TABLE IF EXISTS public.expenses 
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'COP',
    ADD COLUMN IF NOT EXISTS amount_usd NUMERIC,
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

-- 3. TABLA DE USUARIOS PARA AUTENTICACIÓN SEGURA
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_app_users" ON public.app_users;
CREATE POLICY "app_access_app_users" ON public.app_users
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 4. RESTAURAR / INSERTAR EL PROYECTO DEL VIAJE A SAN JUAN PUERTO RICO
-- Se inserta con persona 'Compartido' para que ambos puedan verlo y registrar gastos
INSERT INTO public.projects (
    id,
    name,
    budget_amount,
    person,
    icon,
    color,
    status,
    description,
    created_at
) VALUES (
    'proj_san_juan_pr_2026',
    'Viaje San Juan PR',
    10000000,
    'Compartido',
    '✈️',
    '#0EA5E9',
    'activo',
    'Presupuesto para el viaje a San Juan, Puerto Rico (gastos en USD y COP)',
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    budget_amount = EXCLUDED.budget_amount,
    description = EXCLUDED.description;

COMMIT;
