-- ==============================================================================
-- FIX RLS: Permitir inserción desde Automatización (Google Apps Script)
-- Proyecto: Supabase Producción y Desarrollo
-- ==============================================================================

-- 1. TABLA: public.expenses (Gastos Diarios)
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_expenses" ON public.expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden ver gastos" ON public.expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden crear gastos" ON public.expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar gastos" ON public.expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar gastos" ON public.expenses;
DROP POLICY IF EXISTS "Permitir acceso completo a expenses" ON public.expenses;
CREATE POLICY "app_access_expenses" ON public.expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. TABLA: public.tc_expenses (Tarjetas de Crédito y TC Compartida)
ALTER TABLE IF EXISTS public.tc_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden ver tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden crear tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Permitir acceso completo a tc_expenses" ON public.tc_expenses;
CREATE POLICY "app_access_tc_expenses" ON public.tc_expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. TABLA: public.incomes (Ingresos)
ALTER TABLE IF EXISTS public.incomes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_incomes" ON public.incomes;
DROP POLICY IF EXISTS "Solo autenticados pueden ver ingresos" ON public.incomes;
DROP POLICY IF EXISTS "Solo autenticados pueden crear ingresos" ON public.incomes;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar ingresos" ON public.incomes;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar ingresos" ON public.incomes;
DROP POLICY IF EXISTS "Permitir acceso completo a incomes" ON public.incomes;
CREATE POLICY "app_access_incomes" ON public.incomes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. TABLA: public.debts (Deudas y Créditos)
ALTER TABLE IF EXISTS public.debts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_debts" ON public.debts;
DROP POLICY IF EXISTS "Solo autenticados pueden ver debts" ON public.debts;
DROP POLICY IF EXISTS "Solo autenticados pueden crear debts" ON public.debts;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar debts" ON public.debts;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir acceso completo a debts" ON public.debts;
CREATE POLICY "app_access_debts" ON public.debts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 5. TABLA: public.persons (Personas del Hogar)
ALTER TABLE IF EXISTS public.persons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_persons" ON public.persons;
DROP POLICY IF EXISTS "Solo autenticados pueden ver personas" ON public.persons;
DROP POLICY IF EXISTS "Permitir acceso completo a persons" ON public.persons;
CREATE POLICY "app_access_persons" ON public.persons FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. TABLA: public.fcm_tokens (Registro de Tokens FCM para Notificaciones Push Móviles y Web)
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  person text,
  household_id text DEFAULT 'family-home',
  device_info text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS public.fcm_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir insercion y lectura de tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir lectura publica de fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir insercion publica de fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir actualizacion publica de fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir eliminacion publica de fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir insercion de tokens push autenticados" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir lectura de tokens solo a autenticados" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir actualizacion de tokens solo a autenticados" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir eliminacion de tokens solo a autenticados" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir lectura de fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir insercion de fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir actualizacion de fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir eliminacion de fcm_tokens" ON public.fcm_tokens;
CREATE POLICY "app_access_fcm_tokens" ON public.fcm_tokens FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

