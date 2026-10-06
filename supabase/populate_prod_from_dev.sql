-- ==============================================================================
-- MIGRACIÓN COMPLETA DE DATOS DE DEV A PRODUCCIÓN (PDN)
-- Proyecto destino: fbwljvmqzpmcfokogbpw (PRODUCCIÓN)
-- ==============================================================================

-- 1. POLÍTICAS DE RLS PARA PRODUCCIÓN (Permitir lectura y escritura a la app)
ALTER TABLE IF EXISTS public.persons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_persons" ON public.persons;
DROP POLICY IF EXISTS "Permitir acceso completo a persons" ON public.persons;
CREATE POLICY "app_access_persons" ON public.persons FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_expenses" ON public.expenses;
DROP POLICY IF EXISTS "Permitir acceso completo a expenses" ON public.expenses;
CREATE POLICY "app_access_expenses" ON public.expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.incomes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_incomes" ON public.incomes;
DROP POLICY IF EXISTS "Permitir acceso completo a incomes" ON public.incomes;
CREATE POLICY "app_access_incomes" ON public.incomes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.debts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_debts" ON public.debts;
DROP POLICY IF EXISTS "Permitir acceso completo a debts" ON public.debts;
CREATE POLICY "app_access_debts" ON public.debts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.tc_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_access_tc_expenses" ON public.tc_expenses;
DROP POLICY IF EXISTS "Permitir acceso completo a tc_expenses" ON public.tc_expenses;
CREATE POLICY "app_access_tc_expenses" ON public.tc_expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. PERSONAS (3 registros)
INSERT INTO public.persons (id, name, color, created_at) VALUES ('benny', 'Benny', '#3B82F6', '2026-09-29T16:39:09.135692+00:00') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color;
INSERT INTO public.persons (id, name, color, created_at) VALUES ('charlie', 'Charlie', '#F59E0B', '2026-09-29T16:39:09.135692+00:00') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color;
INSERT INTO public.persons (id, name, color, created_at) VALUES ('compartido', 'Compartido', '#10B981', '2026-09-29T17:39:16.35243+00:00') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color;

-- 3. GASTOS DIARIOS (24 registros)
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('3efd5350-37e9-4b88-9a8a-e4f3b1a37b9e', '2026-07-16', 'Charlie', 'TC-compartida', 'abono Tc compartida', 1000000, '2026-09-30T02:59:31.707067+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('b5e1c488-564a-4812-b0b0-070917f9b742', '2026-10-01', 'Charlie', 'TC: TC Nu Charlie', 'PAgo TC NU', 60000, '2026-10-01T18:06:01.852572+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('9a6dff21-b385-4c8a-a00c-7e1987693f4e', '2026-10-01', 'Charlie', 'TC-compartida', 'PAgo saldo', 3783314, '2026-10-01T18:26:31.559928+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('37557be2-8d66-47e8-ad24-71845ed66ff5', '2026-07-12', 'Charlie', 'Transporte', 'Gasolina vehículo', 150000, '2026-09-29T23:19:38.829138+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('be721834-b7fd-4596-98ec-fb0136d2ecce', '2026-07-15', 'Benny', 'Salud', 'Medicamentos Farmacia', 75000, '2026-09-29T23:19:38.829138+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('2f69171f-ee3c-4e9e-8dfd-02e1c5e7e52b', '2026-07-12', 'Charlie', 'Transporte', 'Gasolina vehículo', 150000, '2026-09-30T02:41:33.767756+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('c6f52add-4d90-4968-b57b-a1b68fc70ede', '2026-07-15', 'Benny', 'Salud', 'Medicamentos Farmacia', 75000, '2026-09-30T02:41:33.767756+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('1f9b7a94-4696-4882-981a-15c8d0963da3', '2026-07-10', 'Benny', 'Mercado', 'Mercado mensual Éxito', 200000, '2026-09-29T23:19:38.829138+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('70fddce3-f94b-4dd4-bcc5-de2614c3444a', '2026-07-10', 'Benny', 'Mercado', 'Mercado mensual Éxito', 200000, '2026-09-30T02:41:33.767756+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('97d3fe12-f968-406c-897d-518823d21b83', '2026-07-09', 'Charlie', 'Entretenimiento/salidas', 'Cena Sushi', 90000, '2026-09-29T23:19:38.829138+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('dfef8f3e-fc27-41d2-9927-4d84f1322fc2', '2026-07-22', 'Charlie', 'Entretenimiento/salidas', 'Almuerzo familiar', 120000, '2026-09-29T23:19:38.829138+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('2ce10b6c-a453-4a3d-969b-36bb11d9863d', '2026-07-25', 'Benny', 'Entretenimiento/salidas', 'Boletas de Cine', 28216, '2026-09-29T23:19:38.829138+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('29543ac1-38b0-4e56-94cc-5e926aa3e5af', '2026-07-09', 'Charlie', 'Entretenimiento/salidas', 'Cena Sushi', 90000, '2026-09-30T02:41:33.767756+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('becb1162-25b8-4610-9c50-def84822549c', '2026-07-22', 'Charlie', 'Entretenimiento/salidas', 'Almuerzo familiar', 120000, '2026-09-30T02:41:33.767756+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('79ae5e76-e3d6-4264-960b-29a18f2b7fd6', '2026-07-25', 'Benny', 'Entretenimiento/salidas', 'Boletas de Cine', 28216, '2026-09-30T02:41:33.767756+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('49f5bf8f-5134-493e-984b-b6a23131ba09', '2026-07-27', 'Benny', 'Compras', 'Compra almacén', 145000, '2026-09-29T23:19:38.829138+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('482b4843-4399-4fce-9b3c-32e2d5b962de', '2026-07-29', 'Charlie', 'Compras', 'Audífonos Bluetooth', 89000, '2026-09-29T23:19:38.829138+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('e00c5d78-9c44-429f-82ad-bc7e508a03c3', '2026-07-27', 'Benny', 'Compras', 'Compra almacén', 145000, '2026-09-30T02:41:33.767756+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('e0c4ef8d-68de-4547-910c-804e8f7a7b15', '2026-07-29', 'Charlie', 'Compras', 'Audífonos Bluetooth', 89000, '2026-09-30T02:41:33.767756+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('81aa1044-6f1f-4ec6-976e-032f7ba62f99', '2026-07-30', 'Benny', 'Salud', 'Corte y barbería', 45000, '2026-09-29T23:19:38.829138+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('ff24dff3-a3e3-4231-8272-a7ed3da00cc2', '2026-07-30', 'Benny', 'Salud', 'Corte y barbería', 45000, '2026-09-30T02:41:33.767756+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('f90b00b1-e4dc-44bf-b987-6e1472a0c2b9', '2026-09-30', 'Charlie', 'Hipoteca Apartamento', 'Pago', 700000, '2026-09-30T18:57:05.743291+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('6ecef487-be32-477a-ac5d-6d6e05fed48e', '2026-10-01', 'Charlie', 'TC: TC Nu Charlie', 'Pago TC', 40000, '2026-10-01T18:03:59.035616+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expenses (id, date, person, category, description, amount, created_at) VALUES ('8b61b5b4-0b37-452e-ba82-7968972f7f47', '2026-10-01', 'Benny', 'TC-compartida', 'PAgo tc compartida', 50000, '2026-10-01T19:29:17.817161+00:00') ON CONFLICT (id) DO NOTHING;

-- 4. INGRESOS (8 registros)
INSERT INTO public.incomes (id, date, person, source, description, amount, created_at) VALUES ('46616030-d147-4700-b321-a9c33da83034', '2026-07-01', 'Benny', 'Salario', 'Salario mensual Benny', 4500000, '2026-09-29T23:19:38.693752+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.incomes (id, date, person, source, description, amount, created_at) VALUES ('c26ac344-c96b-4c95-b490-e8218541048c', '2026-07-01', 'Charlie', 'Salario', 'Salario mensual Charlie', 4200000, '2026-09-29T23:19:38.693752+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.incomes (id, date, person, source, description, amount, created_at) VALUES ('ef1d00b2-5b46-4959-98f4-c9677deb7b10', '2026-07-15', 'Benny', 'Freelance', 'Consultoría UI/UX', 850000, '2026-09-29T23:19:38.693752+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.incomes (id, date, person, source, description, amount, created_at) VALUES ('d42ab320-6ba2-4b6e-8c97-a8a165e24f83', '2026-07-20', 'Charlie', 'Inversiones', 'Rendimientos CDT', 180000, '2026-09-29T23:19:38.693752+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.incomes (id, date, person, source, description, amount, created_at) VALUES ('b8ca2a35-9d0d-4746-9a60-5ba42ffafa18', '2026-07-01', 'Benny', 'Salario', 'Salario mensual Benny', 4500000, '2026-09-30T02:41:33.616227+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.incomes (id, date, person, source, description, amount, created_at) VALUES ('cf8a6efc-1c52-4892-85c4-0684eb1d4bee', '2026-07-01', 'Charlie', 'Salario', 'Salario mensual Charlie', 4200000, '2026-09-30T02:41:33.616227+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.incomes (id, date, person, source, description, amount, created_at) VALUES ('2d962f6b-9ee6-4b6a-891d-a9f6b2120194', '2026-07-15', 'Benny', 'Freelance', 'Consultoría UI/UX', 850000, '2026-09-30T02:41:33.616227+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.incomes (id, date, person, source, description, amount, created_at) VALUES ('906a6f75-b604-4be3-9ecf-80d14fcb4036', '2026-07-20', 'Charlie', 'Inversiones', 'Rendimientos CDT', 180000, '2026-09-30T02:41:33.616227+00:00') ON CONFLICT (id) DO NOTHING;

-- 5. DEUDAS (8 registros)
INSERT INTO public.debts (id, name, person, start_date, original_amount, current_balance, monthly_payment, annual_interest_rate, color, status, total_months, created_at, updated_at) VALUES ('97adfc57-77a1-4ed6-843b-d0aa0ef07547', 'Hipoteca Apartamento', 'Compartido', '2026-07-01', 80000000, 64500000, 700000, 8.5, '#3B82F6', 'activa', NULL, '2026-09-29T23:19:39.185988+00:00', '2026-09-29T23:19:39.185988+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.debts (id, name, person, start_date, original_amount, current_balance, monthly_payment, annual_interest_rate, color, status, total_months, created_at, updated_at) VALUES ('61f39149-0d59-4932-b287-22c08e19c991', 'Crédito Vehículo', 'Benny', '2026-07-01', 22000000, 14200000, 450000, 10.2, '#F59E0B', 'activa', NULL, '2026-09-29T23:19:39.185988+00:00', '2026-09-29T23:19:39.185988+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.debts (id, name, person, start_date, original_amount, current_balance, monthly_payment, annual_interest_rate, color, status, total_months, created_at, updated_at) VALUES ('9f25d352-6226-4f3d-8a80-56945e78f8bb', 'Tarjeta de Crédito', 'Charlie', '2026-07-01', 5000000, 3800000, 500000, 24, '#EF4444', 'activa', NULL, '2026-09-29T23:19:39.185988+00:00', '2026-09-29T23:19:39.185988+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.debts (id, name, person, start_date, original_amount, current_balance, monthly_payment, annual_interest_rate, color, status, total_months, created_at, updated_at) VALUES ('918969a2-12d8-4a33-b210-90a38abfd49d', 'Préstamo Personal', 'Charlie', '2026-07-01', 8000000, 5200000, 350000, 15.5, '#10B981', 'activa', NULL, '2026-09-29T23:19:39.185988+00:00', '2026-09-29T23:19:39.185988+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.debts (id, name, person, start_date, original_amount, current_balance, monthly_payment, annual_interest_rate, color, status, total_months, created_at, updated_at) VALUES ('2a84cc50-1c6c-4d76-a07c-ac2f6de8c096', 'Hipoteca Apartamento', 'Compartido', '2026-07-01', 80000000, 64500000, 700000, 8.5, '#3B82F6', 'activa', NULL, '2026-09-30T02:41:34.126734+00:00', '2026-09-30T02:41:34.126734+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.debts (id, name, person, start_date, original_amount, current_balance, monthly_payment, annual_interest_rate, color, status, total_months, created_at, updated_at) VALUES ('62caf7ce-ddbe-4003-a47c-de2c1d26224b', 'Crédito Vehículo', 'Benny', '2026-07-01', 22000000, 14200000, 450000, 10.2, '#F59E0B', 'activa', NULL, '2026-09-30T02:41:34.126734+00:00', '2026-09-30T02:41:34.126734+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.debts (id, name, person, start_date, original_amount, current_balance, monthly_payment, annual_interest_rate, color, status, total_months, created_at, updated_at) VALUES ('c101ebc3-a08a-4c09-bb54-4cc34f490945', 'Tarjeta de Crédito', 'Charlie', '2026-07-01', 5000000, 3800000, 500000, 24, '#EF4444', 'activa', NULL, '2026-09-30T02:41:34.126734+00:00', '2026-09-30T02:41:34.126734+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.debts (id, name, person, start_date, original_amount, current_balance, monthly_payment, annual_interest_rate, color, status, total_months, created_at, updated_at) VALUES ('d9e1f83e-591f-4f09-a3ff-abfa5b816183', 'Préstamo Personal', 'Charlie', '2026-07-01', 8000000, 5200000, 350000, 15.5, '#10B981', 'activa', NULL, '2026-09-30T02:41:34.126734+00:00', '2026-09-30T02:41:34.126734+00:00') ON CONFLICT (id) DO NOTHING;

-- 6. CONSUMOS TC COMPARTIDA (11 registros)
INSERT INTO public.tc_expenses (id, date, person, description, amount, category, created_at) VALUES ('ee699cb1-0c08-44e5-883d-efb7c15836b3', '2026-07-05', 'Compartido', 'Arriendo apartamento', 1800000, 'Hogar', '2026-09-29T23:19:38.829138+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tc_expenses (id, date, person, description, amount, category, created_at) VALUES ('25dd0e21-aa54-44ea-bfc4-b70a32b9e054', '2026-07-05', 'Compartido', 'Arriendo apartamento', 1800000, 'Hogar', '2026-09-30T02:41:33.767756+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tc_expenses (id, date, person, description, amount, category, created_at) VALUES ('99f15078-27c5-43a3-8430-f488df455057', '2026-07-28', 'Compartido', 'Supermercado reposición', 161657, 'Mercado', '2026-09-29T23:19:38.829138+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tc_expenses (id, date, person, description, amount, category, created_at) VALUES ('9a77ee00-e4a4-429c-8467-b08877c58a1a', '2026-07-28', 'Compartido', 'Supermercado reposición', 161657, 'Mercado', '2026-09-30T02:41:33.767756+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tc_expenses (id, date, person, description, amount, category, created_at) VALUES ('ea535ef7-0d21-4ae0-8b7d-e27ccff4f5b4', '2026-07-08', 'Compartido', 'Servicios públicos (Agua, Luz, Gas)', 320000, 'Servicios públicos', '2026-09-29T23:19:38.829138+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tc_expenses (id, date, person, description, amount, category, created_at) VALUES ('007bd1b1-796c-4ddf-9742-37aad039aeee', '2026-07-18', 'Compartido', 'Internet fibra óptica', 110000, 'Servicios públicos', '2026-09-29T23:19:38.829138+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tc_expenses (id, date, person, description, amount, category, created_at) VALUES ('1827c581-97a8-4f31-88a3-a1cccf83a460', '2026-07-08', 'Compartido', 'Servicios públicos (Agua, Luz, Gas)', 320000, 'Servicios públicos', '2026-09-30T02:41:33.767756+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tc_expenses (id, date, person, description, amount, category, created_at) VALUES ('11615e89-4a5b-4718-8b19-fd3c813ca16d', '2026-07-18', 'Compartido', 'Internet fibra óptica', 110000, 'Servicios públicos', '2026-09-30T02:41:33.767756+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tc_expenses (id, date, person, description, amount, category, created_at) VALUES ('854e5473-ebee-4784-8830-293757d44334', '2026-10-01', 'Charlie', '[CARD:tc-nu-charlie] Video Juego', 50000, 'General', '2026-10-01T18:03:10.343915+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tc_expenses (id, date, person, description, amount, category, created_at) VALUES ('988e156c-339e-4f65-87f5-0a6fdb53f77e', '2026-10-01', 'Charlie', '[CARD:tc-nu-charlie] Mercado', 50000, 'General', '2026-10-01T18:05:21.466347+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tc_expenses (id, date, person, description, amount, category, created_at) VALUES ('e44c3410-d914-4132-b2fc-ff556a0085ad', '2026-10-01', 'Compartido', 'D1 comida', 50000, 'General', '2026-10-01T18:26:59.776496+00:00') ON CONFLICT (id) DO NOTHING;
