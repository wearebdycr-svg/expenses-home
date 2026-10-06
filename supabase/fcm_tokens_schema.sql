-- ==============================================================================
-- HU-009: Esquema de Tokens FCM para Notificaciones Push en Tiempo Real
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person TEXT NOT NULL, -- 'Benny' | 'Charlie' | 'Hogar (Móvil)'
  household_id TEXT NOT NULL DEFAULT 'family-home',
  token TEXT NOT NULL UNIQUE,
  device_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso idempotentes para gestión de tokens
DROP POLICY IF EXISTS "Permitir lectura publica de fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir insercion publica de fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir actualizacion publica de fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir eliminacion publica de fcm_tokens" ON public.fcm_tokens;

CREATE POLICY "Permitir lectura de fcm_tokens" ON public.fcm_tokens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insercion de fcm_tokens" ON public.fcm_tokens FOR INSERT TO authenticated WITH CHECK (char_length(token) > 10);
CREATE POLICY "Permitir actualizacion de fcm_tokens" ON public.fcm_tokens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir eliminacion de fcm_tokens" ON public.fcm_tokens FOR DELETE TO authenticated USING (true);

-- Agregar fcm_tokens a la publicación de tiempo real de Supabase de manera segura
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'fcm_tokens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fcm_tokens;
  END IF;
END $$;
