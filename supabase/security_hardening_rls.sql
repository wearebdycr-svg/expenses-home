-- ==============================================================================
-- EXPENSES HOME: Blindaje de Ciberseguridad y Row Level Security (RLS)
-- ==============================================================================
-- Este script revoca las políticas abiertas a usuarios anónimos ('anon') y
-- restringe el acceso de lectura y escritura exclusivamente a usuarios
-- autenticados ('authenticated').
--
-- INSTRUCCIONES:
-- 1. Ve a tu panel de Supabase: SQL Editor
-- 2. Pega este contenido completo y ejecuta "Run".
-- ==============================================================================

-- 0. TABLA: public.persons (Personas del Hogar: Benny, Charlie, Compartido)
ALTER TABLE IF EXISTS public.persons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso completo a personas" ON public.persons;
DROP POLICY IF EXISTS "Solo autenticados pueden ver personas" ON public.persons;

CREATE POLICY "Solo autenticados pueden ver personas"
ON public.persons FOR SELECT
TO authenticated
USING (true);


-- 1. TABLA: public.expenses (Gastos Diarios)
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso completo a gastos" ON public.expenses;
DROP POLICY IF EXISTS "Permitir lectura a todos" ON public.expenses;
DROP POLICY IF EXISTS "Permitir insercion a todos" ON public.expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden ver gastos" ON public.expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden crear gastos" ON public.expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar gastos" ON public.expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar gastos" ON public.expenses;

CREATE POLICY "Solo autenticados pueden ver gastos"
ON public.expenses FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Solo autenticados pueden crear gastos"
ON public.expenses FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden actualizar gastos"
ON public.expenses FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden eliminar gastos"
ON public.expenses FOR DELETE
TO authenticated
USING (true);


-- 2. TABLA: public.incomes (Ingresos)
ALTER TABLE IF EXISTS public.incomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso completo a ingresos" ON public.incomes;
DROP POLICY IF EXISTS "Solo autenticados pueden ver ingresos" ON public.incomes;
DROP POLICY IF EXISTS "Solo autenticados pueden crear ingresos" ON public.incomes;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar ingresos" ON public.incomes;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar ingresos" ON public.incomes;

CREATE POLICY "Solo autenticados pueden ver ingresos"
ON public.incomes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Solo autenticados pueden crear ingresos"
ON public.incomes FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden actualizar ingresos"
ON public.incomes FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden eliminar ingresos"
ON public.incomes FOR DELETE
TO authenticated
USING (true);


-- 3. TABLA: public.debts (Deudas y Créditos)
ALTER TABLE IF EXISTS public.debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso completo a deudas" ON public.debts;
DROP POLICY IF EXISTS "Permitir lectura de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir insercion de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir actualizacion de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir eliminacion de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir lectura publica de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir insercion publica de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir actualizacion publica de debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir eliminacion publica de debts" ON public.debts;
DROP POLICY IF EXISTS "Solo autenticados pueden ver deudas" ON public.debts;
DROP POLICY IF EXISTS "Solo autenticados pueden crear deudas" ON public.debts;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar deudas" ON public.debts;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar deudas" ON public.debts;

CREATE POLICY "Solo autenticados pueden ver deudas"
ON public.debts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Solo autenticados pueden crear deudas"
ON public.debts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden actualizar deudas"
ON public.debts FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden eliminar deudas"
ON public.debts FOR DELETE
TO authenticated
USING (true);


-- 4. TABLA: public.tc_expenses (Consumos de Tarjeta de Crédito Compartida)
ALTER TABLE IF EXISTS public.tc_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Permitir insercion de tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Permitir actualizacion de tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Permitir eliminacion de tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden ver tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden crear tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Solo autenticados pueden eliminar tc_expenses" ON public.tc_expenses;

CREATE POLICY "Solo autenticados pueden ver tc_expenses"
ON public.tc_expenses FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Solo autenticados pueden crear tc_expenses"
ON public.tc_expenses FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden actualizar tc_expenses"
ON public.tc_expenses FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden eliminar tc_expenses"
ON public.tc_expenses FOR DELETE
TO authenticated
USING (true);


-- 5. TABLA: public.fcm_tokens (Tokens de Notificaciones Push)
ALTER TABLE IF EXISTS public.fcm_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir insercion y lectura de tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir lectura publica de fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir insercion publica de fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir actualizacion publica de fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir eliminacion publica de fcm_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir insercion de tokens push autenticados" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir lectura de tokens solo a autenticados" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir actualizacion de tokens solo a autenticados" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Permitir eliminacion de tokens solo a autenticados" ON public.fcm_tokens;

CREATE POLICY "Permitir insercion de tokens push autenticados"
ON public.fcm_tokens FOR INSERT
TO authenticated
WITH CHECK (char_length(token) > 10);

CREATE POLICY "Permitir lectura de tokens solo a autenticados"
ON public.fcm_tokens FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir actualizacion de tokens solo a autenticados"
ON public.fcm_tokens FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Permitir eliminacion de tokens solo a autenticados"
ON public.fcm_tokens FOR DELETE
TO authenticated
USING (true);
