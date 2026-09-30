-- ==============================================================================
-- Migración: Mover Gastos Compartidos a TC Compartida y limpiar Gastos Diarios
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

-- 1. Insertar en tc_expenses todos los gastos que estaban en expenses como 'Compartido'
INSERT INTO public.tc_expenses (id, date, person, description, amount, category, created_at)
SELECT 
    id::text, 
    date, 
    person, 
    description, 
    amount, 
    category, 
    created_at
FROM public.expenses
WHERE person = 'Compartido'
ON CONFLICT (id) DO UPDATE 
SET 
    date = EXCLUDED.date,
    person = EXCLUDED.person,
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    category = EXCLUDED.category;

-- 2. Eliminar de expenses los gastos compartidos para que no aparezcan en la vista de Gastos Diarios
DELETE FROM public.expenses
WHERE person = 'Compartido';

-- 3. Verificación de la migración:
-- SELECT count(*) AS gastos_diarios_compartidos_restantes FROM public.expenses WHERE person = 'Compartido';
-- SELECT count(*) AS consumos_en_tc_compartida FROM public.tc_expenses;
