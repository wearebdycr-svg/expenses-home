-- ==============================================================================
-- EXPENSES-HOME: Disparadores de Notificaciones Push vía Database Webhooks (pg_net)
-- ==============================================================================
-- Fecha: 2026-10-05
-- Descripción:
-- Este script desacopla el despacho de notificaciones Push del Frontend y lo traslada
-- al motor de base de datos de PostgreSQL en Supabase.
-- 
-- Cada vez que ocurre un INSERT o DELETE en cualquiera de las 4 tablas principales:
--   1. public.expenses (Gastos diarios)
--   2. public.tc_expenses (Consumos Tarjeta de Crédito Compartida)
--   3. public.incomes (Ingresos / Salarios / Abonos)
--   4. public.debts (Deudas y Créditos)
--
-- La base de datos invoca asíncronamente a Vercel Serverless Function:
--   POST https://finanzas-hogar-control-familiar.vercel.app/api/notify
-- 
-- Esto garantiza entrega de alertas incluso si la app móvil está cerrada o si el registro
-- entra por integraciones externas (ej. Google Apps Script con Bancolombia).
-- ==============================================================================

-- 1. Habilitar la extensión oficial pg_net (llamadas HTTP asíncronas desde Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Función genérica que empaqueta el evento y lo envía al endpoint de Vercel
CREATE OR REPLACE FUNCTION public.handle_expense_notify()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://finanzas-hogar-control-familiar.vercel.app/api/notify',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', row_to_json(NEW),
      'old_record', CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END
    )::jsonb,
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Triggers para las 4 tablas principales

-- A. Gastos Diarios (public.expenses)
DROP TRIGGER IF EXISTS tr_notify_on_expense ON public.expenses;
CREATE TRIGGER tr_notify_on_expense
AFTER INSERT OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.handle_expense_notify();

-- B. Tarjeta de Crédito Compartida (public.tc_expenses)
DROP TRIGGER IF EXISTS tr_notify_on_tc_expense ON public.tc_expenses;
CREATE TRIGGER tr_notify_on_tc_expense
AFTER INSERT OR DELETE ON public.tc_expenses
FOR EACH ROW EXECUTE FUNCTION public.handle_expense_notify();

-- C. Ingresos (public.incomes)
DROP TRIGGER IF EXISTS tr_notify_on_income ON public.incomes;
CREATE TRIGGER tr_notify_on_income
AFTER INSERT OR DELETE ON public.incomes
FOR EACH ROW EXECUTE FUNCTION public.handle_expense_notify();

-- D. Deudas (public.debts)
DROP TRIGGER IF EXISTS tr_notify_on_debt ON public.debts;
CREATE TRIGGER tr_notify_on_debt
AFTER INSERT OR DELETE ON public.debts
FOR EACH ROW EXECUTE FUNCTION public.handle_expense_notify();

-- ==============================================================================
-- CONSULTAS ÚTILES DE MONITOREO EN SUPABASE SQL EDITOR:
-- ==============================================================================
-- Ver historial de respuestas HTTP recibidas por pg_net:
-- SELECT id, status_code, content, error_msg, timed_out, created FROM net._http_response ORDER BY created DESC LIMIT 10;
-- 
-- Ver estado de triggers activos:
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE trigger_name LIKE 'tr_notify_%';
-- ==============================================================================
