-- ==============================================================================
-- EXPENSES HOME: Blindaje de Ciberseguridad y Row Level Security (RLS)
-- ==============================================================================
-- Este script revoca las políticas abiertas a usuarios anónimos ('anon') y
-- restringe el acceso de lectura y escritura exclusivamente a usuarios
-- autenticados ('authenticated').
--
-- INSTRUCCIONES:
-- 1. Ve a tu panel de Supabase: https://supabase.com/dashboard/project/zmechahctplsnnauxvju
-- 2. Entra en SQL Editor y abre una nueva pestaña.
-- 3. Pega este contenido y ejecuta "Run".
-- ==============================================================================

-- 0. TABLA: public.persons (Personas del Hogar)
ALTER TABLE IF EXISTS public.persons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso completo a personas" ON public.persons;
DROP POLICY IF EXISTS "Solo autenticados pueden ver personas" ON public.persons;

CREATE POLICY "Solo autenticados pueden ver personas"
ON public.persons FOR SELECT
TO authenticated
USING (true);


-- 1. TABLA: public.expenses (Gastos Diarios)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso completo a gastos" ON public.expenses;
DROP POLICY IF EXISTS "Permitir lectura a todos" ON public.expenses;
DROP POLICY IF EXISTS "Permitir insercion a todos" ON public.expenses;

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
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso completo a ingresos" ON public.incomes;

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
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso completo a deudas" ON public.debts;

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


-- 4. TABLA: public.debt_payments (Abonos a Deudas)
ALTER TABLE IF EXISTS public.debt_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso completo a abonos" ON public.debt_payments;

CREATE POLICY "Solo autenticados pueden ver abonos"
ON public.debt_payments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Solo autenticados pueden crear abonos"
ON public.debt_payments FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden eliminar abonos"
ON public.debt_payments FOR DELETE
TO authenticated
USING (true);


-- 5. TABLA: public.tc_cards (Tarjetas de Crédito)
ALTER TABLE IF EXISTS public.tc_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso a tc_cards" ON public.tc_cards;

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


-- 6. TABLA: public.tc_expenses (Consumos de Tarjetas de Crédito)
ALTER TABLE public.tc_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Permitir insercion de tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Permitir actualizacion de tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Permitir eliminacion de tc_expenses" ON public.tc_expenses;

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


-- 7. TABLA: public.tc_payments (Abonos a Tarjetas de Crédito)
ALTER TABLE IF EXISTS public.tc_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de tc_payments" ON public.tc_payments;
DROP POLICY IF EXISTS "Permitir insercion de tc_payments" ON public.tc_payments;
DROP POLICY IF EXISTS "Permitir eliminacion de tc_payments" ON public.tc_payments;

CREATE POLICY "Solo autenticados pueden ver tc_payments"
ON public.tc_payments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Solo autenticados pueden crear tc_payments"
ON public.tc_payments FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden eliminar tc_payments"
ON public.tc_payments FOR DELETE
TO authenticated
USING (true);


-- 8. TABLA: public.fcm_tokens (Tokens de Notificaciones Push)
-- Permitir registrar tokens push con validación
ALTER TABLE IF EXISTS public.fcm_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir insercion y lectura de tokens" ON public.fcm_tokens;

CREATE POLICY "Permitir insercion de tokens push autenticados"
ON public.fcm_tokens FOR INSERT
TO authenticated, anon
WITH CHECK (char_length(token) > 10);

CREATE POLICY "Permitir lectura de tokens solo a autenticados"
ON public.fcm_tokens FOR SELECT
TO authenticated
USING (true);
