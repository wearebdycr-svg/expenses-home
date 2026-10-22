-- ==============================================================================
-- SCRIPT DE DESPLIEGUE A SUPABASE: TABLA DE TARJETAS DE CRÉDITO (tc_cards)
-- Ejecutar en el SQL Editor de Supabase (tanto en DEV como en PRODUCCIÓN)
-- Totalmente idempotente, no destructivo y transaccional (BEGIN...COMMIT)
-- ==============================================================================

BEGIN;

-- 1. Crear tabla para las tarjetas de crédito
CREATE TABLE IF NOT EXISTS public.tc_cards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bank TEXT NOT NULL,
    last_digits TEXT NOT NULL,
    person TEXT NOT NULL REFERENCES public.persons(name) ON UPDATE CASCADE,
    theme_id TEXT NOT NULL,
    color TEXT NOT NULL,
    gradient TEXT NOT NULL,
    quota NUMERIC,
    payment_category TEXT DEFAULT 'TC-compartida',
    is_default BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.tc_cards ENABLE ROW LEVEL SECURITY;

-- 3. Limpiar y recrear políticas RLS para usuarios autenticados
DROP POLICY IF EXISTS "Solo autenticados pueden ver tc_cards" ON public.tc_cards;
DROP POLICY IF EXISTS "Solo autenticados pueden crear tc_cards" ON public.tc_cards;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar tc_cards" ON public.tc_cards;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar tc_cards" ON public.tc_cards;

CREATE POLICY "Solo autenticados pueden ver tc_cards"
ON public.tc_cards FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Solo autenticados pueden crear tc_cards"
ON public.tc_cards FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden actualizar tc_cards"
ON public.tc_cards FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden eliminar tc_cards"
ON public.tc_cards FOR DELETE
TO authenticated
USING (true);

-- 4. Habilitar Replicación en Tiempo Real (Realtime)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'tc_cards'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tc_cards;
    END IF;
END $$;

-- 5. Sembrar tarjetas por defecto
INSERT INTO public.tc_cards (
    id, name, bank, last_digits, person, theme_id, color, gradient, quota, payment_category, is_default, description
)
VALUES 
  (
    'tc-compartida',
    'TC Compartida',
    'Bancolombia',
    '0066',
    'Compartido',
    'emerald',
    '#10B981',
    'linear-gradient(135deg, #065F46 0%, #10B981 50%, #047857 100%)',
    5000000,
    'TC-compartida',
    true,
    'Tarjeta compartida principal de compras del hogar y mercado'
  ),
  (
    'tc-nu-charlie',
    'TC Nu Charlie',
    'Nu Colombia',
    '4312',
    'Charlie',
    'nu-purple',
    '#820AD1',
    'linear-gradient(135deg, #530082 0%, #820AD1 50%, #3C0060 100%)',
    3000000,
    'Deudas',
    false,
    'Tarjeta de crédito personal Nu'
  )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    bank = EXCLUDED.bank,
    last_digits = EXCLUDED.last_digits,
    person = EXCLUDED.person,
    theme_id = EXCLUDED.theme_id,
    color = EXCLUDED.color,
    gradient = EXCLUDED.gradient,
    payment_category = EXCLUDED.payment_category;

COMMIT;
