-- ==============================================================================
-- Migración SQL: Agregar categoría 'TC-compartida' a la tabla expenses
-- Ejecutar en el SQL Editor de Supabase (tanto en DEV como en PROD)
-- ==============================================================================

-- 1. Eliminar la restricción previa de categorías
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- 2. Crear la nueva restricción con 'TC-compartida' incluida
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check CHECK (category IN (
    'Alimentación',
    'Transporte',
    'Salud',
    'Entretenimiento',
    'Educación',
    'Ropa',
    'Tecnología',
    'Restaurantes',
    'Cuidado Personal',
    'Hogar',
    'Servicios',
    'Ahorro / Inversión',
    'TC-compartida',
    'Otros'
));
