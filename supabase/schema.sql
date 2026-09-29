-- ==============================================================================
-- Esquema de Base de Datos para Expenses Home (Supabase / PostgreSQL)
-- Totalmente desde 0: Tablas limpias sin ingresos de prueba
-- Personas: Benny y Charlie
-- ==============================================================================

-- 1. Tabla de Personas
CREATE TABLE IF NOT EXISTS public.persons (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Habilitar Seguridad a Nivel de Fila (RLS) para persons
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso completo a personas"
ON public.persons
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Insertar las personas iniciales: Benny y Charlie
INSERT INTO public.persons (id, name, color) VALUES
  ('benny', 'Benny', '#3B82F6'),
  ('charlie', 'Charlie', '#F59E0B')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color;

-- 2. Tabla de Ingresos (Limpia desde 0)
CREATE TABLE IF NOT EXISTS public.incomes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date DATE NOT NULL,
    person TEXT NOT NULL REFERENCES public.persons(name) ON UPDATE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('Salario', 'Freelance', 'Arriendo', 'Inversiones', 'Bono', 'Otros')),
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Habilitar Seguridad a Nivel de Fila (RLS) para incomes
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso completo a ingresos"
ON public.incomes
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 3. Habilitar Replicación en Tiempo Real (Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE public.persons;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incomes;
