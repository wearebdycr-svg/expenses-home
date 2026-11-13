-- ==============================================================================
-- Tabla de Registro y Deduplicación de Ejecución de Crons (cron_executions)
-- Aísla el estado operativo de los crons serverless (gastos fijos, recordatorios)
-- fuera de la tabla de negocio category_budgets.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.cron_executions (
    job_name TEXT PRIMARY KEY,
    last_run_date NUMERIC NOT NULL, -- Formato entero YYYYMMDD (ej. 20261112)
    last_run_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Comentarios explicativos
COMMENT ON TABLE public.cron_executions IS 'Registro de ejecuciones e idempotencia de jobs programados / crons serverless';
COMMENT ON COLUMN public.cron_executions.job_name IS 'Identificador único del job (ej. fixed_expenses, daily_reminder_7pm)';
COMMENT ON COLUMN public.cron_executions.last_run_date IS 'Fecha colombiana entera YYYYMMDD de la última ejecución exitosa';
COMMENT ON COLUMN public.cron_executions.metadata IS 'Métricas y detalles de la ejecución (alertas despachadas, fecha ISO, etc.)';

-- Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.cron_executions ENABLE ROW LEVEL SECURITY;

-- Revocar permisos a anon por seguridad
REVOKE ALL ON TABLE public.cron_executions FROM anon;

-- Políticas de acceso para usuarios autenticados:
-- cron_executions es manipulado exclusivamente por el backend serverless usando SUPABASE_SERVICE_ROLE_KEY (que bypasses RLS).
-- Los clientes web/móvil únicamente requieren permiso de lectura para monitoreo o auditoría;
-- NUNCA deben insertar ni modificar ejecuciones operacionales.
DROP POLICY IF EXISTS "Solo autenticados pueden ver cron_executions" ON public.cron_executions;
DROP POLICY IF EXISTS "Solo autenticados pueden insertar cron_executions" ON public.cron_executions;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar cron_executions" ON public.cron_executions;

CREATE POLICY "Solo autenticados pueden ver cron_executions"
ON public.cron_executions FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Limpieza idempotente de registros sentinela históricos en category_budgets
DELETE FROM public.category_budgets WHERE category LIKE '__cron_%';
