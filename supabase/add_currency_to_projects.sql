-- ==============================================================================
-- AGREGAR COLUMNA CURRENCY A LA TABLA PROJECTS
-- Ejecutar en el SQL Editor de Supabase (DEV y PRODUCCIÓN)
-- ==============================================================================

ALTER TABLE IF EXISTS public.projects 
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'COP';

-- Notificar a PostgREST para recargar el esquema inmediatamente
NOTIFY pgrst, 'reload schema';
