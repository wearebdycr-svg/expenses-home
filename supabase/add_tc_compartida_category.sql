-- ==============================================================================
-- Migración SQL: Configuración de las 15 categorías oficiales
-- Ejecutar en el SQL Editor de Supabase (tanto en DEV como en PROD)
-- ==============================================================================

-- 1. Eliminar la restricción previa de categorías
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- 2. Crear la nueva restricción con las 15 categorías oficiales
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check CHECK (category IN (
    'Ahorro/inversión',
    'Compras',
    'Deudas',
    'Educación',
    'Entretenimiento/salidas',
    'Hogar',
    'Mercado',
    'Otros',
    'Regalos',
    'Salud',
    'Servicios públicos',
    'Suscripciones',
    'Transporte',
    'Viajes',
    'TC-compartida'
));
