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

-- Políticas de acceso para lectura y escritura anónima (app de hogar sin login complejo)
CREATE POLICY "Permitir lectura publica de debts" ON public.debts FOR SELECT USING (true);
CREATE POLICY "Permitir insercion publica de debts" ON public.debts FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualizacion publica de debts" ON public.debts FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminacion publica de debts" ON public.debts FOR DELETE USING (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.debts;
