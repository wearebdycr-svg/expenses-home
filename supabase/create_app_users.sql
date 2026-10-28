-- ==============================================================================
-- MIGRACIÓN SUPABASE: TABLA DE USUARIOS DE LA APLICACIÓN (app_users)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura e inserción para la app
DROP POLICY IF EXISTS "Permitir lectura de app_users" ON public.app_users;
CREATE POLICY "Permitir lectura de app_users"
ON public.app_users FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Permitir insercion de app_users" ON public.app_users;
CREATE POLICY "Permitir insercion de app_users"
ON public.app_users FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion de app_users" ON public.app_users;
CREATE POLICY "Permitir actualizacion de app_users"
ON public.app_users FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
