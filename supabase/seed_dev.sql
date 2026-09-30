-- ==============================================================================
-- SEED DATA EXCLUSIVO PARA BASE DE DATOS DE PRUEBAS / DESARROLLO (DEV)
-- Ejecutar ÚNICAMENTE en el SQL Editor del proyecto Supabase de DEV
-- NUNCA EJECUTAR EN PRODUCCIÓN
-- ==============================================================================

-- 1. Asegurar personas base
INSERT INTO public.persons (id, name, color) VALUES
  ('benny', 'Benny', '#3B82F6'),
  ('charlie', 'Charlie', '#F59E0B'),
  ('compartido', 'Compartido', '#10B981')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color;

-- 2. Limpiar datos previos de prueba en DEV (si existen)
DELETE FROM public.expenses;
DELETE FROM public.incomes;
DELETE FROM public.debts;

-- 3. Insertar Ingresos de Prueba (Julio 2026)
INSERT INTO public.incomes (date, person, source, description, amount) VALUES
  ('2026-07-01', 'Benny', 'Salario', 'Salario mensual Benny', 4500000),
  ('2026-07-01', 'Charlie', 'Salario', 'Salario mensual Charlie', 4200000),
  ('2026-07-15', 'Benny', 'Freelance', 'Consultoría UI/UX', 850000),
  ('2026-07-20', 'Charlie', 'Inversiones', 'Rendimientos CDT', 180000);

-- 4. Insertar Gastos Diarios de Prueba (Julio 2026 - Gastos personales de Benny y Charlie)
INSERT INTO public.expenses (date, person, category, description, amount) VALUES
  ('2026-07-09', 'Charlie', 'Entretenimiento/salidas', 'Cena Sushi', 90000),
  ('2026-07-10', 'Benny', 'Mercado', 'Mercado mensual Éxito', 200000),
  ('2026-07-12', 'Charlie', 'Transporte', 'Gasolina vehículo', 150000),
  ('2026-07-15', 'Benny', 'Salud', 'Medicamentos Farmacia', 75000),
  ('2026-07-22', 'Charlie', 'Entretenimiento/salidas', 'Almuerzo familiar', 120000),
  ('2026-07-25', 'Benny', 'Entretenimiento/salidas', 'Boletas de Cine', 28216),
  ('2026-07-26', 'Charlie', 'TC-compartida', 'Abono Cuota TC Compartida Bancolombia', 1000000),
  ('2026-07-27', 'Benny', 'Compras', 'Compra almacén', 145000),
  ('2026-07-29', 'Charlie', 'Compras', 'Audífonos Bluetooth', 89000),
  ('2026-07-30', 'Benny', 'Salud', 'Corte y barbería', 45000);

-- 5. Insertar Deudas de Prueba (HU06)
INSERT INTO public.debts (name, person, start_date, original_amount, current_balance, monthly_payment, annual_interest_rate, color) VALUES
  ('Hipoteca Apartamento', 'Compartido', '2026-07-01', 80000000, 64500000, 700000, 8.5, '#3B82F6'),
  ('Crédito Vehículo', 'Benny', '2026-07-01', 22000000, 14200000, 450000, 10.2, '#F59E0B'),
  ('Tarjeta de Crédito', 'Charlie', '2026-07-01', 5000000, 3800000, 500000, 24.0, '#EF4444'),
  ('Préstamo Personal', 'Charlie', '2026-07-01', 8000000, 5200000, 350000, 15.5, '#10B981');

-- 6. Insertar Consumos Directos de TC Compartida de Prueba (incluyendo gastos compartidos del hogar)
DELETE FROM public.tc_expenses;
INSERT INTO public.tc_expenses (date, person, description, amount, category) VALUES
  ('2026-07-04', 'Benny', 'Tiquetes Aéreos Vacaciones', 650000, 'Viajes'),
  ('2026-07-05', 'Compartido', 'Arriendo apartamento', 1800000, 'Hogar'),
  ('2026-07-08', 'Compartido', 'Servicios públicos (Agua, Luz, Gas)', 320000, 'Servicios públicos'),
  ('2026-07-11', 'Charlie', 'Cena Aniversario Restaurante', 220000, 'Entretenimiento/salidas'),
  ('2026-07-16', 'Compartido', 'Compra Smart TV Sala', 1400000, 'Compras'),
  ('2026-07-18', 'Compartido', 'Internet fibra óptica', 110000, 'Servicios públicos'),
  ('2026-07-24', 'Benny', 'Mercado Mayorista Alkosto', 380000, 'Mercado'),
  ('2026-07-28', 'Compartido', 'Supermercado reposición', 161657, 'Mercado');

-- 7. Nota sobre el Abono en Gastos Diarios:
-- Total consumos TC = $4,941,657
-- Abono en gastos diarios con 'TC-compartida' = $1,000,000
-- Deuda pendiente amortizada = $3,941,657

