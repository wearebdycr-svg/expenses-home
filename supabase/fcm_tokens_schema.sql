-- ==============================================================================
-- HU-009: Esquema de Tokens FCM para Notificaciones Push en Tiempo Real
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person TEXT NOT NULL, -- 'Benny' | 'Charlie'
  household_id TEXT NOT NULL DEFAULT 'family-home',
  token TEXT NOT NULL UNIQUE,
  device_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para gestión de tokens
CREATE POLICY "Permitir lectura publica de fcm_tokens" ON public.fcm_tokens FOR SELECT USING (true);
CREATE POLICY "Permitir insercion publica de fcm_tokens" ON public.fcm_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualizacion publica de fcm_tokens" ON public.fcm_tokens FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminacion publica de fcm_tokens" ON public.fcm_tokens FOR DELETE USING (true);

-- Agregar fcm_tokens a la publicación de tiempo real de Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE public.fcm_tokens;
