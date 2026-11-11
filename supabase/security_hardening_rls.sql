-- ==============================================================================
-- EXPENSES HOME: Blindaje de Ciberseguridad y Row Level Security (RLS)
-- Idempotente y tolerante a entornos donde algunas tablas opcionales aún no existan.
-- ==============================================================================

DO $rls$
DECLARE
  rec RECORD;
  target_tbl TEXT;
  pol TEXT;
BEGIN
  -- 0. TABLA: public.persons (Personas del Hogar: Solo lectura para autenticados)
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'persons'
  ) THEN
    EXECUTE 'ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.persons FROM anon';

    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'persons'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.persons', pol);
    END LOOP;

    EXECUTE $p$
      CREATE POLICY "Solo autenticados pueden ver personas"
      ON public.persons FOR SELECT
      TO authenticated
      USING (auth.uid() IS NOT NULL)
    $p$;
  ELSE
    RAISE NOTICE 'Tabla public.persons no existe en esta BD; se omite.';
  END IF;

  -- 1–4, 6–8. TABLAS CRUD DEL HOGAR
  FOR rec IN
    SELECT * FROM (
      VALUES
        ('expenses', 'gastos'),
        ('incomes', 'ingresos'),
        ('debts', 'deudas'),
        ('tc_expenses', 'tc_expenses'),
        ('tc_cards', 'tc_cards'),
        ('projects', 'projects'),
        ('project_expenses', 'project_expenses')
    ) AS t(tbl_name, label)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = rec.tbl_name
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', rec.tbl_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', rec.tbl_name);

      FOR pol IN
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = rec.tbl_name
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, rec.tbl_name);
      END LOOP;

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)',
        'Solo autenticados pueden ver ' || rec.label,
        rec.tbl_name
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)',
        'Solo autenticados pueden crear ' || rec.label,
        rec.tbl_name
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
        'Solo autenticados pueden actualizar ' || rec.label,
        rec.tbl_name
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL)',
        'Solo autenticados pueden eliminar ' || rec.label,
        rec.tbl_name
      );
    ELSE
      RAISE NOTICE 'Tabla public.% no existe en esta BD; se omite.', rec.tbl_name;
    END IF;
  END LOOP;

  -- 5. TABLA: public.fcm_tokens (Tokens de Notificaciones Push)
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fcm_tokens'
  ) THEN
    EXECUTE 'ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.fcm_tokens FROM anon';

    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fcm_tokens'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.fcm_tokens', pol);
    END LOOP;

    EXECUTE $p$
      CREATE POLICY "Permitir insercion de tokens push autenticados"
      ON public.fcm_tokens FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL AND char_length(token) > 10)
    $p$;
    EXECUTE $p$
      CREATE POLICY "Permitir lectura de tokens solo a autenticados"
      ON public.fcm_tokens FOR SELECT
      TO authenticated
      USING (auth.uid() IS NOT NULL)
    $p$;
    EXECUTE $p$
      CREATE POLICY "Permitir actualizacion de tokens solo a autenticados"
      ON public.fcm_tokens FOR UPDATE
      TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL AND char_length(token) > 10)
    $p$;
    EXECUTE $p$
      CREATE POLICY "Permitir eliminacion de tokens solo a autenticados"
      ON public.fcm_tokens FOR DELETE
      TO authenticated
      USING (auth.uid() IS NOT NULL)
    $p$;
  ELSE
    RAISE NOTICE 'Tabla public.fcm_tokens no existe en esta BD; se omite.';
  END IF;

  -- 9–10. TABLAS FOR ALL: category_budgets y fixed_expenses
  FOREACH target_tbl IN ARRAY ARRAY['category_budgets', 'fixed_expenses']
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = target_tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_tbl);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', target_tbl);

      FOR pol IN
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = target_tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, target_tbl);
      END LOOP;

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
        'Solo autenticados pueden acceder a ' || target_tbl,
        target_tbl
      );
    ELSE
      RAISE NOTICE 'Tabla public.% no existe en esta BD; se omite.', target_tbl;
    END IF;
  END LOOP;

  -- 11. TABLA: public.app_users (Sin acceso directo desde clientes Supabase)
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_users'
  ) THEN
    EXECUTE 'ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.app_users FROM anon, authenticated';

    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_users'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.app_users', pol);
    END LOOP;
  ELSE
    RAISE NOTICE 'Tabla public.app_users no existe en esta BD; se omite.';
  END IF;

  -- 12. VISTA: public.v_monthly_summary (Security Invoker y sin acceso anónimo)
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'v_monthly_summary'
  ) THEN
    EXECUTE 'ALTER VIEW public.v_monthly_summary SET (security_invoker = true)';
    EXECUTE 'REVOKE ALL ON public.v_monthly_summary FROM anon';
    EXECUTE 'GRANT SELECT ON public.v_monthly_summary TO authenticated';
  ELSE
    RAISE NOTICE 'Vista public.v_monthly_summary no existe en esta BD; se omite.';
  END IF;
END $rls$;
