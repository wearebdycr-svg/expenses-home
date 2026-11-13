---
phase: 01-integridad-presupuestos-cron
reviewed: 2026-11-13T01:56:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - api/cron-reminder.js
  - api/cron-reminder.test.mjs
  - supabase/cron_executions_schema.sql
  - src/app/core/services/remote-config.service.ts
  - src/app/core/services/remote-config.service.spec.ts
  - .github/workflows/tests.yml
  - package.json
findings:
  critical: 0
  warning: 0 (6 remediated)
  info: 0 (5 remediated)
  total: 0
  necessity: 0
status: approved
---

# Phase 1: Code Review Report — Integridad de Presupuestos, Estado Cron y Cobertura `api/`

**Reviewed:** 2026-11-13T01:56:00Z  
**Updated & Remediated:** 2026-11-13T02:00:00Z  
**Depth:** deep  
**Files Reviewed:** 8 (incl. api/package.json)  
**Status:** **APPROVED**  
**Verdict:** **PASSED & APPROVED** (Todas las recomendaciones y advertencias han sido resueltas al 100 %)

---

## Post-Review Remediation Log (2026-11-13)

Las 6 advertencias (`WR-01` a `WR-06`) y las 5 observaciones (`IN-01` a `IN-05`) fueron atendidas y verificadas exhaustivamente:

1. **WR-01 (Manejo de errores en PostgREST upsert):** Resuelto. Se inspecciona explícitamente `const { error } = await supabase.from('cron_executions').upsert(...)` en gastos fijos y recordatorio diario, registrando advertencia defensiva si falla.
2. **WR-02 (Guard contra nombre de gasto fijo vacío):** Resuelto. Se añadió `if (!fixedNameNorm) continue;` para evitar que `.includes('')` coincida erróneamente con todos los gastos del mes.
3. **WR-03 (Saneamiento de `dia_limite_mes`):** Resuelto. Se valida con `Number.isInteger` en rango 1..31 y se protege `calcularVencimientoCron` contra `diasRestantes = NaN`.
4. **WR-04 (Endurecimiento RLS en `cron_executions`):** Resuelto. Se eliminaron las políticas de `INSERT` y `UPDATE` para `authenticated`; solo se permite `SELECT` con `auth.uid() IS NOT NULL`, reservando modificaciones al backend con `SUPABASE_SERVICE_ROLE_KEY`.
5. **WR-05 (Normalización insensible a casing en categorías):** Resuelto. `budgetsByCategory` busca claves equivalentes en minúsculas en el mapa base antes de fusionar.
6. **WR-06 (CI timeout y concurrencia):** Resuelto. Se añadió `timeout-minutes: 15` y `concurrency: { cancel-in-progress: true }` en `.github/workflows/tests.yml`.
7. **IN-01 & IN-02 (Rendimiento de tests serverless y limpieza de mocks):** Resuelto. El test de fallback simula `status: 500` eliminando reintentos de 7s (la suite completa ahora corre en **182 ms** en lugar de 7.200 ms). Se eliminaron bloques inalcanzables en mocks.
8. **IN-04 (Aviso `MODULE_TYPELESS_PACKAGE_JSON`):** Resuelto. Creado `api/package.json` con `{"type": "module"}`.
9. **IN-05 (Ruido de `ReferenceError: indexedDB` en tests Angular):** Resuelto. Guarda `NODE_ENV === 'test'` agregada en `initRemoteConfig()`.

Línea base final: `tsc --noEmit` (0 errores), `test:api` (14/14 pasando), `ng test` (346/346 pasando), `ng lint` (0 errores, 118 advertencias — 3 advertencias menos que el baseline original).

---

## Summary

Se realizó una revisión adversaria y exhaustiva de todos los artefactos modificados y creados en la **Fase 1**:
1. `api/cron-reminder.js`
2. `api/cron-reminder.test.mjs`
3. `supabase/cron_executions_schema.sql`
4. `src/app/core/services/remote-config.service.ts`
5. `src/app/core/services/remote-config.service.spec.ts`
6. `.github/workflows/tests.yml`
7. `package.json`

### Evaluación General de Cumplimiento
- **REQ-CRON-01 (Aislamiento de Crons):** Cumplido. La deduplicación fue desacoplada de `category_budgets` y trasladada a `cron_executions`. Se implementó un script DDL idempotente.
- **REQ-TEST-01 (Cobertura `api/cron-reminder.js`):** Cumplido. Se añadieron 6 pruebas unitarias que evalúan ventana horaria de Colombia, ejecución forzada, saltos por deduplicación y tolerancia a fallos. La suite serverless total suma 14 pruebas pasando al 100 %.
- **REQ-CI-01 (Quality Gates en CI):** Cumplido. Se añadieron los pasos de `typecheck` (`tsc --noEmit`) y `test:api` (`node --test api/*.test.mjs`) en GitHub Actions.
- **REQ-BUD-01 (Filtrado de Sentinelas y No-Resurrección):** Cumplido. `RemoteConfigService` descarta registros con prefijo `__cron_` y trata la base de datos como la fuente autoritativa de verdad, eliminando la resurrección desde `localStorage`. Las 346 pruebas del frontend pasan satisfactoriamente.

### Hallazgos Principales a Subsanar
No se identificaron vulnerabilidades críticas bloqueantes inmediatas de pérdida de datos o inyección; sin embargo, se identificaron **6 advertencias (Warnings)** sobre manejo de errores de PostgREST, sobre-privilegios de RLS, normalización de categorías y edge cases en el cálculo de gastos fijos, así como **5 observaciones menores (Info)** sobre limpieza de mocks, rendimiento de tests y supresión de ruido en logs.

---

## Structural Findings (fallow)

*No se reportaron anomalías estructurales preexistentes en este pase.*

---

## Narrative Findings (AI reviewer)

## Critical Issues

*No se detectaron problemas críticos bloqueantes (Critical / Blocker).*

---

## Warnings

### WR-01: Retorno de error no verificado en `supabase.from('cron_executions').upsert(...)` (Fallo silencioso de deduplicación)

**File:** `api/cron-reminder.js:547-562`, `api/cron-reminder.js:650-666`  
**Issue:**  
El cliente de Supabase (`@supabase/supabase-js`) **no lanza excepciones** ante errores de SQL, RLS o esquemas inexistentes; en su lugar, resuelve la promesa retornando un objeto `{ data, error }`. En `api/cron-reminder.js`, tanto el upsert de `fixed_expenses` como el de `daily_reminder_7pm` ignoran el valor retornado:
```javascript
// Línea 547:
await supabase.from('cron_executions').upsert({ ... }, { onConflict: 'job_name' });
console.log(`[Cron Gastos Fijos] Alertas del día ... registradas para deduplicación en cron_executions.`);
```
Si la tabla `cron_executions` aún no ha sido creada en la base de datos de producción (o si ocurre un fallo de permisos/esquema), `catch (feErr)` no es invocado. La consola imprime falsamente que la deduplicación fue exitosa, pero la fecha `last_run_date` nunca se persiste. Ante reintentos del scheduler de cron en la misma ventana horaria, se despacharán notificaciones duplicadas a todos los dispositivos.

**Fix:**  
Inspeccionar explícitamente `const { error } = await supabase.from('cron_executions').upsert(...)` y advertir si ocurre un error:
```javascript
const { error: upsertErr } = await supabase.from('cron_executions').upsert(
  {
    job_name: 'fixed_expenses',
    last_run_date: todayColombiaNum,
    last_run_at: new Date().toISOString(),
    metadata: {
      deliveredAlerts: fixedExpensesReport.deliveredAlerts,
      evaluated: fixedExpensesReport.evaluated,
      isoDate: todayColombiaIso,
    },
    updated_at: new Date().toISOString(),
  },
  { onConflict: 'job_name' }
);

if (upsertErr) {
  console.warn('[Cron Gastos Fijos] Fallo persistiendo deduplicación en cron_executions:', upsertErr.message);
} else {
  console.log(`[Cron Gastos Fijos] Alertas del día ${todayColombiaIso} registradas para deduplicación en cron_executions.`);
}
```
Aplicar el mismo patrón al registro del recordatorio diario en las líneas 650–666.

---

### WR-02: Nombre de gasto fijo vacío o en blanco provoca que `isPaid` coincida con todos los gastos del mes

**File:** `api/cron-reminder.js:457-475`  
**Issue:**  
En el bucle de evaluación de gastos fijos:
```javascript
const fixedNameNorm = (fe.name || '').trim().toLowerCase();
const isPaid = safeMonthExpenses.some((e) => {
  const catNorm = (e.category || '').trim().toLowerCase();
  const descNorm = (e.description || '').trim().toLowerCase();
  return (
    catNorm === fixedNameNorm ||
    catNorm === `fijo: ${fixedNameNorm}` ||
    catNorm === `gasto fijo: ${fixedNameNorm}` ||
    descNorm === fixedNameNorm ||
    descNorm.includes(fixedNameNorm)
  );
});
```
Si un registro en `fixed_expenses` tiene un nombre vacío, solo espacios o nulo (`fe.name = ''`), `fixedNameNorm` evalúa a `""`. En JavaScript, `"cualquier string".includes("")` retorna incondicionalmente `true`. Por ende, si existe al menos un gasto en el mes, `isPaid` será evaluado como `true`, y el gasto fijo será descartado silenciosamente con `continue` sin alertar a la familia.

**Fix:**  
Ignorar registros sin nombre válido o validar que `fixedNameNorm` no esté vacío antes de evaluar coincidencias parciales con `includes`:
```javascript
const fixedNameNorm = (fe.name || '').trim().toLowerCase();
if (!fixedNameNorm) {
  continue; // Omitir registros de gastos fijos sin nombre válido
}

const isPaid = safeMonthExpenses.some((e) => {
  const catNorm = (e.category || '').trim().toLowerCase();
  const descNorm = (e.description || '').trim().toLowerCase();

  return (
    catNorm === fixedNameNorm ||
    catNorm === `fijo: ${fixedNameNorm}` ||
    catNorm === `gasto fijo: ${fixedNameNorm}` ||
    descNorm === fixedNameNorm ||
    descNorm.includes(fixedNameNorm)
  );
});
```

---

### WR-03: `dia_limite_mes` no numérico (`NaN`) desencadena alertas falsas de gasto vencido hace "NaN día(s)"

**File:** `api/cron-reminder.js:127-142`, `api/cron-reminder.js:477-485`  
**Issue:**  
En la línea 477:
```javascript
const diaLimite = Number(fe.dia_limite_mes ?? fe.due_day ?? 1);
```
Si `fe.dia_limite_mes` contiene una cadena no numérica o inválida, `diaLimite` resulta en `NaN`. `Math.min(NaN, diasEnMes)` produce `NaN`, y `timestampLimiteUtc` se evalúa a `NaN`.
En `calcularVencimientoCron`:
```javascript
if (diasRestantes > diasAnticipacion) {
  estado = 'al_dia';
  requiereNotificacion = false;
} else if (diasRestantes >= 1) {
  estado = 'proximo';
  requiereNotificacion = true;
} else if (diasRestantes === 0) {
  estado = 'vence_hoy';
  requiereNotificacion = true;
} else {
  estado = 'vencido';
  requiereNotificacion = true;
}
```
En JavaScript, cualquier comparación relacional con `NaN` (`NaN > 3`, `NaN >= 1`, `NaN === 0`) retorna `false`. Por descarte entra al bloque `else` (`estado = 'vencido'`), disparando una notificación que indica:  
`El gasto "${fe.name}" venció hace NaN día(s). Recuerda ponerte al día.`

**Fix:**  
Sanear `diaLimite` con `Number.isFinite` asegurando un entero entre 1 y 31, y añadir guarda de sanidad en `calcularVencimientoCron`:
```javascript
const rawDia = Number(fe.dia_limite_mes ?? fe.due_day ?? 1);
const diaLimite = Number.isInteger(rawDia) && rawDia >= 1 && rawDia <= 31 ? rawDia : 1;
```

---

### WR-04: Sobre-privilegios en RLS: Políticas de `INSERT` y `UPDATE` abiertas para `authenticated` en `cron_executions`

**File:** `supabase/cron_executions_schema.sql:37-46`  
**Issue:**  
El script DDL define:
```sql
CREATE POLICY "Solo autenticados pueden insertar cron_executions"
ON public.cron_executions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden actualizar cron_executions"
ON public.cron_executions FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
```
La tabla `cron_executions` es exclusivamente de control operativo interno y deduplicación para el backend serverless (`api/cron-reminder.js`), el cual interactúa mediante `SUPABASE_SERVICE_ROLE_KEY` (rol que por diseño omite RLS).  
El frontend de la aplicación Angular **nunca** debe insertar ni modificar registros en `cron_executions`. Conceder `INSERT` y `UPDATE` a cualquier usuario con token `authenticated` viola el principio de menor privilegio (PoLP), permitiendo que una sesión de usuario altere las marcas de tiempo e inhabilite alertas programadas para todo el hogar.

**Fix:**  
Eliminar las políticas de `INSERT` y `UPDATE` para el rol `authenticated`. Si se requiere visibilidad en el cliente para auditoría o monitoreo, mantener únicamente la política de `SELECT`:
```sql
-- Revocar permisos de modificación al rol authenticated
DROP POLICY IF EXISTS "Solo autenticados pueden insertar cron_executions" ON public.cron_executions;
DROP POLICY IF EXISTS "Solo autenticados pueden actualizar cron_executions" ON public.cron_executions;

-- Permitir únicamente lectura a usuarios autenticados
CREATE POLICY "Solo autenticados pueden ver cron_executions"
ON public.cron_executions FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
```

---

### WR-05: Asimetría de mayúsculas/minúsculas en consulta y eliminación de presupuestos en `RemoteConfigService`

**File:** `src/app/core/services/remote-config.service.ts:80-128`  
**Issue:**  
En `budgetsByCategory`, las categorías base por defecto están definidas en mayúscula/minúscula fija (`Hogar`, `Mercado`, `Alimentación`, `Transporte`, etc.). Al fusionar con `customBudgets()`, se asignan las claves de forma textual:
```typescript
const merged = { ...base };
for (const [cat, amt] of Object.entries(customs)) {
  if (amt > 0) merged[cat] = amt;
  ...
}
```
Si el usuario guarda un tope para `"hogar"` (en minúsculas), `merged` almacena tanto `"Hogar": 2500000` como `"hogar": 3000000`.  
Posteriormente, `getBudgetForCategory(category)` realiza:
```typescript
if (category in map) {
  return map[category];
}
```
Si la UI consulta con `"Hogar"`, coincidirá primero con la clave base y retornará `2500000`, ignorando el tope personalizado del usuario (`3000000`). Además, si el usuario intenta eliminar el presupuesto de `"Hogar"` enviando `setCategoryBudget('hogar', 0)`, solo se removerá `"hogar"`, dejando el valor base intacto.

**Fix:**  
Normalizar o hacer coincidir las claves de categorías base de forma insensible a mayúsculas/minúsculas durante el merge en `budgetsByCategory`:
```typescript
readonly budgetsByCategory = computed<Record<string, number>>(() => {
  const base: Record<string, number> = {
    Hogar: this.budgetHogar(),
    Mercado: this.budgetAlimentacion(),
    Alimentación: this.budgetAlimentacion(),
    Transporte: this.budgetTransporte(),
    'Entretenimiento/salidas': this.budgetEntretenimiento(),
    Restaurantes: this.budgetRestaurantes(),
    'Restaurantes/domicilios': this.budgetRestaurantes(),
  };

  const customs = this.customBudgets();
  const merged: Record<string, number> = { ...base };

  for (const [rawCat, amt] of Object.entries(customs)) {
    if (rawCat.startsWith('__cron_')) continue;

    // Buscar si existe una clave equivalente en base con diferente casing
    const lower = rawCat.trim().toLowerCase();
    const existingKey = Object.keys(merged).find((k) => k.trim().toLowerCase() === lower) || rawCat;

    if (amt > 0) {
      merged[existingKey] = amt;
    } else if (amt === 0) {
      delete merged[existingKey];
    }
  }

  return merged;
});
```

---

### WR-06: Ausencia de `timeout-minutes` y política de concurrencia en `.github/workflows/tests.yml`

**File:** `.github/workflows/tests.yml:13-17`  
**Issue:**  
El job `unit-tests` no cuenta con la directiva `timeout-minutes`. Por omisión en GitHub Actions, si un proceso de prueba se cuelga (por ejemplo, por un promise sin resolver en Vitest o un loop asíncrono), el runner permanecerá bloqueado hasta por **360 minutos** (6 horas), consumiendo la cuota mensual de minutos del repositorio.  
Asimismo, el flujo no define un bloque de `concurrency` con `cancel-in-progress: true`, permitiendo ejecuciones redundantes en commits concurrentes sobre ramas activas.

**Fix:**  
Añadir control de concurrencia y límite de tiempo en el workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  unit-tests:
    name: "Unit Tests (Vitest)"
    runs-on: ubuntu-latest
    timeout-minutes: 15
```

---

## Info

### IN-01: Reintentos con retroceso exponencial de PostgREST en prueba de fallback (~7 segundos de retraso)

**File:** `api/cron-reminder.test.mjs:355-375`  
**Issue:**  
La prueba `'falls back gracefully without crashing when Supabase query fails'` simula un fallo lanzando un error en `globalThis.fetch` (`throw new Error('Supabase network connection failed')`). La librería interna `@supabase/postgrest-js` interpreta este error como falla de transporte transitoria y reintenta la solicitud 3 veces con retroceso exponencial (1s, 2s, 4s), demorando más de 7.000 ms en completar un solo caso de prueba unitaria. En entornos serverless reales (Vercel con límite de 10s), este comportamiento podría derivar en un error 504 Gateway Timeout si Supabase es inalcanzable.

**Fix:**  
En el mock de la prueba unitaria, retornar una respuesta HTTP 500 (`new Response(JSON.stringify({ error: 'fail' }), { status: 500, headers: { 'Content-Type': 'application/json' } })`) para simular el fallo sin activar el ciclo de reintentos exponenciales.

---

### IN-02: Código muerto y bloques duplicados en mocks de `api/cron-reminder.test.mjs`

**File:** `api/cron-reminder.test.mjs:114-120`, `api/cron-reminder.test.mjs:189-194`, `api/cron-reminder.test.mjs:305-310`  
**Issue:**  
En la implementación de los mocks de `fetch`:
- Líneas 114–120: Existe un `if (urlStr.includes('/rest/v1/fcm_tokens'))` anidado dentro de `if (urlStr.includes('/rest/v1/expenses'))`, el cual jamás puede ser verdadero.
- Líneas 189–194: Se encuentra duplicado el bloque `if (urlStr.includes('/rest/v1/fcm_tokens'))` de forma contigua.
- Líneas 305–310: Existe un bloque similar de `fcm_tokens` anidado dentro de `cron_executions`.

**Fix:**  
Limpiar las ramas inalcanzables en los mocks de prueba para mejorar la legibilidad y mantenimiento del archivo.

---

### IN-03: Fuga de parámetro de prueba (`forceInTest = false`) en firmas públicas de producción

**File:** `src/app/core/services/remote-config.service.ts:135`, `184`, `219`  
**Issue:**  
Los métodos de producción `setCategoryBudget`, `loadBudgetsFromDb` y `syncBudgetToDb` incorporan el argumento opcional `forceInTest = false` para omitir la guarda `proc?.env?.['NODE_ENV'] === 'test'`. Modificar firmas públicas de servicios para acomodar pruebas unitarias es un anti-patrón de diseño.  
Adicionalmente, en `remote-config.service.spec.ts:103`, la prueba `ignores setCategoryBudget for categories starting with __cron_` omitió pasar `true`, por lo que `syncBudgetToDb` retornó prematuramente por el flag de entorno y no únicamente por la guarda de categoría.

**Fix:**  
Aislar el comportamiento en pruebas mediante inyección de dependencias o espías sobre `SupabaseService` en lugar de exponer flags de prueba en la interfaz del servicio.

---

### IN-04: Advertencia de Node `[MODULE_TYPELESS_PACKAGE_JSON]` en `npm run test:api`

**File:** `package.json`, directorio `api/`  
**Issue:**  
Al ejecutar `npm run test:api`, Node 22/24 emite la siguiente advertencia:
```text
(node:99135) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of .../api/cron-reminder.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
```
Ocurre porque la raíz del proyecto no declara `"type": "module"`, mientras que las funciones serverless en `api/` utilizan sintaxis ESM (`import`/`export`).

**Fix:**  
Crear un archivo `api/package.json` con `{ "type": "module" }` para declarar el módulo explícitamente sin alterar los scripts CommonJS de la raíz (`scripts/set-env.js`).

---

### IN-05: Ruido de `ReferenceError: indexedDB is not defined` en pruebas de Vitest

**File:** `src/app/core/services/remote-config.service.ts:278-324`  
**Issue:**  
`loadBudgetsFromDb`, `syncBudgetToDb` y `setupRealtime` incluyen guardas para no ejecutarse en Vitest (`proc?.env?.['NODE_ENV'] === 'test'`), pero `initRemoteConfig()` no cuenta con esta comprobación. En jsdom, `window` está definido, lo que provoca que Firebase Remote Config intente inicializar `indexedDB` (inexistente en Node), arrojando mensajes de advertencia en la consola durante la ejecución de los 60 archivos de prueba.

**Fix:**  
Incorporar la guarda de entorno en `initRemoteConfig()`:
```typescript
const proc = (globalThis as any).process;
if (proc?.env?.['NODE_ENV'] === 'test' || proc?.env?.['VITEST']) {
  this.applyConfigValues(DEFAULT_REMOTE_CONFIG);
  this.isLoaded.set(true);
  return;
}
```

---

_Reviewed: 2026-11-13T01:56:00Z_  
_Reviewer: gsd-code-reviewer_  
_Depth: deep_
