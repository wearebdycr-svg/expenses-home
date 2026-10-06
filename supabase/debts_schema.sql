-- Tabla de Deudas / Préstamos
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  person TEXT NOT NULL, -- 'Benny', 'Charlie', 'Compartido'
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  original_amount NUMERIC NOT NULL,
  current_balance NUMERIC NOT NULL,
  monthly_payment NUMERIC NOT NULL,
  annual_interest_rate NUMERIC NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para usuarios autenticados
CREATE POLICY "Permitir lectura de debts" ON public.debts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insercion de debts" ON public.debts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir actualizacion de debts" ON public.debts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir eliminacion de debts" ON public.debts FOR DELETE TO authenticated USING (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.debts;
