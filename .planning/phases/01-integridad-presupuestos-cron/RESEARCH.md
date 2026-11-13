# RESEARCH.md — Fase 1: Integridad de Presupuestos, Estado Cron y Cobertura `api/`

> **Fase:** 01-integridad-presupuestos-cron  
> **Fecha:** 2026-11-12  
> **Requerimientos asociados:** `REQ-CRON-01`, `REQ-BUD-01`, `REQ-TEST-01`, `REQ-CI-01`  
> **Prioridad origen:** `P1.1` (de `.planning/codebase/CONCERNS.md`) + `P2` (tests de cron) + CI gates

---

## 1. Diagnóstico del Estado Actual

### 1.1. Acoplamiento de Crons en `category_budgets` (`REQ-CRON-01`)
- En `api/cron-reminder.js`:
  - **Líneas 413–417:** Al evaluar deduplicación de gastos fijos, consulta `category_budgets` buscando la fila `category = '__cron_fixed_expenses__'`.
  - **Líneas 547–554:** Al despachar alertas de gastos fijos, ejecuta `upsert` en `category_budgets` con `category: '__cron_fixed_expenses__'`, `amount: todayColombiaNum` (entero `YYYYMMDD`) y `updated_at: new Date().toISOString()`.
  - **Líneas 580–584:** Al verificar deduplicación del recordatorio diario de las 7:00 PM, consulta `category_budgets` buscando `category = '__cron_reminder_7pm__'`.
  - **Líneas 644–651:** Al despachar el recordatorio diario, ejecuta `upsert` en `category_budgets` con `category: '__cron_reminder_7pm__'`.
- **Impacto arquitectónico y de datos:**
  - `category_budgets` es la tabla de negocio que almacena los topes presupuestales mensuales de la familia (Hogar, Mercado, Transporte, etc.).
  - Mezclar metadatos de cron en esta tabla introduce registros sentinela que contaminan el cliente Angular, los canales Realtime de presupuestos y las vistas analíticas.
  - No existe modelo relacional ni trazabilidad de ejecuciones previas (sólo sobreescribe la misma fila).

### 1.2. Contaminación de Presupuestos y Resurrección Local (`REQ-BUD-01`)
- En `src/app/core/services/remote-config.service.ts`:
  - **Líneas 171–201 (`loadBudgetsFromDb`):**
    ```typescript
    const local = this.loadCustomBudgetsFromStorage();
    const map: Record<string, number> = { ...local };
    for (const row of data) {
      if (row.category) {
        map[String(row.category)] = Number(row.amount);
      }
    }
    this.customBudgets.set(map);
    this.saveCustomBudgetsToStorage(map);
    ```
    - Si `category_budgets` tiene `__cron_*`, se incorporan a `map` y se persisten en `localStorage` (`expenses_home_category_budgets_v1`).
    - Si un presupuesto se elimina en la base de datos (o mediante `setCategoryBudget(cat, 0)`), al recargar o sincronizar, `local` retiene la clave borrada porque `map` se inicializa clonando `{ ...local }` y sólo sobreescribe lo que viene en `data`. Por ende, los presupuestos eliminados resucitan.
  - **Líneas 135–146 (`setCategoryBudget`):**
    - Cuando `amount <= 0`, asigna `current[cleanCat] = 0` en lugar de borrar la clave (`delete current[cleanCat]`), dejando entradas zombi con valor 0.
  - **Líneas 172–175:**
    - `loadBudgetsFromDb()` tiene una guarda temprana:
      ```typescript
      const proc = (globalThis as any).process;
      if (proc?.env?.['NODE_ENV'] === 'test' || proc?.env?.['VITEST']) {
        return;
      }
      ```
      Esto impide que las pruebas unitarias validen `loadBudgetsFromDb()`, dejando sin cobertura esta ruta crítica.

### 1.3. Cobertura de Pruebas de `api/cron-reminder.js` (`REQ-TEST-01`)
- `api/security.test.mjs` cuenta con 8 pruebas de hardening serverless (CORS, tokens, secretos), pero evalúa el endpoint solo superficialmente ante credenciales ausentes o inválidas.
- No existe ninguna prueba unitaria para la lógica interna de `api/cron-reminder.js`:
  - Cálculo de fechas en zona horaria Colombia (`America/Bogota`).
  - Evaluación de vencimientos (`calcularVencimientoGastoFijo` puro: `al_dia`, `proximo`, `vence_hoy`, `vencido`).
  - Lógica de omisión si la familia ya registró gastos hoy en `expenses`.
  - Deduplicación idempotente contra `cron_executions`.
  - Paginación/envío de tokens FCM.

### 1.4. Pipeline de CI en GitHub Actions (`REQ-CI-01`)
- En `.github/workflows/tests.yml`:
  - Solo ejecuta `npm run test:ci` (Vitest de Angular).
  - No ejecuta `node --test api/*.test.mjs` ni `npx tsc --noEmit`.
  - Un error de tipos en TypeScript o una regresión en las funciones serverless de Vercel puede pasar desapercibido en PRs hacia `develop` o `main`.

---

## 2. Decisiones Técnicas y Solución Propuesta

### 2.1. Nueva Tabla `public.cron_executions`
Se diseñará un script SQL idempotente en `supabase/cron_executions_schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS public.cron_executions (
    job_name TEXT PRIMARY KEY,
    last_run_date NUMERIC NOT NULL, -- Formato entero YYYYMMDD (ej. 20261112)
    last_run_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Habilitar RLS y revocar a anon
ALTER TABLE public.cron_executions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cron_executions FROM anon;

-- Políticas para usuarios autenticados y backend
DROP POLICY IF EXISTS "Solo autenticados pueden ver cron_executions" ON public.cron_executions;
DROP POLICY IF EXISTS "Solo autenticados pueden insertar cron_executions" ON public.cron_executions;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar cron_executions" ON public.cron_executions;

CREATE POLICY "Solo autenticados pueden ver cron_executions"
ON public.cron_executions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Solo autenticados pueden insertar cron_executions"
ON public.cron_executions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden actualizar cron_executions"
ON public.cron_executions FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Limpieza de registros sentinela en category_budgets
DELETE FROM public.category_budgets WHERE category LIKE '__cron_%';
```
*Nota:* El cliente serverless de Supabase utiliza `SUPABASE_SERVICE_ROLE_KEY` o un usuario con token de servicio, el cual tiene acceso completo y omite RLS por diseño.

### 2.2. Adaptación de `api/cron-reminder.js`
1. Reemplazar lecturas de `category_budgets` por `cron_executions`:
   - Para gastos fijos: `job_name = 'fixed_expenses'`.
   - Para recordatorio 7 PM: `job_name = 'daily_reminder_7pm'`.
2. Registrar metadatos ricos en `metadata` (alertas entregadas, fecha ISO, total evaluado).
3. Mantener tolerancia a fallos: si la tabla `cron_executions` no estuviera disponible, atrapar el error sin interrumpir el flujo del cron.

### 2.3. Saneamiento en `RemoteConfigService`
1. **Filtro defensivo:** Ignorar en `loadBudgetsFromDb()` cualquier fila con `row.category?.startsWith('__cron_')`.
2. **Fuente de verdad:** Al recibir `data` de Supabase, construir el mapa a partir de los datos recibidos (descartando claves locales que ya no existan en base de datos), de modo que un presupuesto borrado en la BD no resucite desde `localStorage`.
3. **Limpieza explícita:** En `setCategoryBudget()`, cuando `amount <= 0`, ejecutar `delete current[cleanCat]` en lugar de asignar `0`.
4. **Testabilidad:** Permitir que `loadBudgetsFromDb()` y métodos auxiliares puedan ejecutarse y probarse en entorno de test cuando se inyecte un mock de Supabase.

### 2.4. Suite de Pruebas `api/cron-reminder.test.mjs`
Crear `api/cron-reminder.test.mjs` usando el runner nativo de Node (`node:test` y `node:assert/strict`) cubriendo:
- Evaluación de deduplicación con `cron_executions` (salta si `last_run_date === todayColombiaNum`).
- Salto del recordatorio diario si existen gastos en el día.
- Manejo cuando `cronType === 'fixed_expenses'` vs `cronType === 'daily_reminder'` vs `cronType === 'all'`.
- Resiliencia y respuestas HTTP adecuadas (`200` con reporte de ejecución).

### 2.5. Actualización de `.github/workflows/tests.yml` y `package.json`
- Añadir pasos en el workflow:
  ```yaml
  - name: TypeScript Type Check
    run: npx tsc --noEmit

  - name: Run Serverless Node Tests
    run: node --test api/*.test.mjs
  ```
- Añadir scripts convenientes en `package.json`:
  ```json
  "test:api": "node --test api/*.test.mjs",
  "typecheck": "tsc --noEmit"
  ```

---

## 3. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
| :--- | :--- | :--- |
| En DEV/PROD la tabla `cron_executions` no se crea de inmediato tras el deploy. | Posible fallo al intentar deduplicar. | `cron-reminder.js` envolverá las llamadas a `cron_executions` en `try/catch` con log de advertencia. Si la tabla no existe, el cron ejecuta normalmente sin crashear. |
| Incompatibilidad de tests unitarios de `RemoteConfigService` con Firebase en `jsdom`. | Error `indexedDB is not defined` en consola de tests. | En `RemoteConfigService`, aislar la lógica de presupuestos (`category_budgets`) para que sea testeable independientemente de la inicialización de Firebase Remote Config. |
| Node emite warning `MODULE_TYPELESS_PACKAGE_JSON` al correr tests ESM. | Ruido visual en stderr. | Mantener extensiones `.mjs` o `.js` compatibles con ESM y asegurar que los tests corran de forma limpia. |
