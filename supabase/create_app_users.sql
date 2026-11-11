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

-- Habilitar Row Level Security (RLS) sin políticas cliente para proteger hashes/salts
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_users FROM anon, authenticated;

DROP POLICY IF EXISTS "Permitir lectura de app_users" ON public.app_users;
DROP POLICY IF EXISTS "Permitir insercion de app_users" ON public.app_users;
DROP POLICY IF EXISTS "Permitir actualizacion de app_users" ON public.app_users;
DROP POLICY IF EXISTS "app_access_app_users" ON public.app_users;
