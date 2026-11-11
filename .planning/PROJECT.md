# PROJECT.md — Finanzas Hogar (`expenses-home`)

> **Última actualización:** 2026-11-11  
> **Rama base / Producción:** `develop` / `main` (commit `b285688`)  
> **Tipo de documento:** Visión, contexto actual y objetivos del milestone vigente

---

## 1. Visión y Propósito del Milestone Actual

**Finanzas Hogar (`expenses-home`)** es una aplicación financiera familiar *local-first* con sincronización en tiempo real para gestionar gastos diarios, ingresos, categorías y presupuestos, gastos fijos, deudas con amortización francesa, tarjetas de crédito compartidas (`tc-compartida`) y proyectos multimoneda (COP/USD con TRM).

Tras el último pase a producción (`bda3d3f` y `b285688`), el objetivo de este milestone es **100 % estabilización, cierre de deuda técnica prioritaria (`P1`), seguridad operativa de integraciones y confiabilidad en producción**. No se incorporan nuevas funcionalidades de negocio en este ciclo; todo el esfuerzo se concentra en eliminar bugs de consistencia de datos, blindar la compilación estricta en TypeScript, consolidar las migraciones SQL y retirar secretos privilegiados de scripts externos.

---

## 2. Contexto Actual del Código

### 2.1. Stack y Arquitectura Vigente
- **Frontend Web / Híbrido:** Angular `^22.2.1` (`standalone: true`, `ChangeDetectionStrategy.OnPush`, Signals), TypeScript `~6.0.2`, CSS nativo con tokens en `src/styles.css`, Chart.js `4.5.1` / `ng2-charts` `10.0.0`, y Capacitor `^8.5.2` (Android / Gradle 8.14.3 / Java 21).
- **Navegación y Carga:** Enrutamiento reactivo por hash (`NavigationService` + `window.location.hash` + `localStorage`) sin `<router-outlet>`.
- **Persistencia y Tiempo Real:** Patrón *Local-First + Cloud Realtime* sobre Supabase (`@supabase/supabase-js` `^2.117.2`, PostgreSQL + RLS + WebSockets + vista `v_monthly_summary`).
- **Backend Serverless y Push:** Vercel Functions ESM en `api/` (`_security.js`, `notify.js`, `fcm-token.js`, `cron-reminder.js`) integradas con Firebase Cloud Messaging (`firebase` `^12.19.0`) y Firebase Remote Config.
- **Integraciones Externas:** APIs públicas de TRM (`datos.gov.co` y `open.er-api.com`), sincronizador bancario de correos en Google Apps Script (`automation/bancolombia-sync/bancolombia-sync.gs`) y triggers programados.
- **CI/CD Principal:** **GitHub Actions** (`.github/workflows/tests.yml`, `scan.yml`, `deploy.yml`, `android-apk.yml`, `reminders-cron.yml`).

### 2.2. Hardening (`P0`) Ya Aplicado Hasta `b285688`
Al momento de iniciar este milestone, los riesgos críticos `P0` documentados originalmente en `.planning/codebase/CONCERNS.md` ya fueron atendidos en código y en base de datos:
1. **`P0.1` Seguridad Serverless (`231e7f9`):** `api/_security.js`, `api/notify.js`, `api/fcm-token.js` y `api/cron-reminder.js` aplican allowlist CORS, verificación fail-closed de secretos en tiempo constante y validación de JWT de Supabase; protegidos por `api/security.test.mjs` (8 tests).
2. **`P0.2` Endurecimiento RLS (Operación confirmada):** El script `supabase/security_hardening_rls.sql` ya fue ejecutado manualmente en los entornos **DEV y PROD** de Supabase.
3. **`P0.3` Autenticación Única y Caducidad de Sesión (`bda3d3f`):** Se eliminaron `AuthPinService` y `PinLock`. La app exige únicamente inicio de sesión por correo/contraseña vía Supabase Auth (`SupabaseAuthService` + `AuthLogin`), con expiración deslizante a los **10 minutos de inactividad** (`SESSION_INACTIVITY_TIMEOUT_MS`), modo *fail-closed* y bloqueo de **30 segundos** tras **5 intentos fallidos** (`MAX_LOGIN_ATTEMPTS`, `LOGIN_LOCKOUT_MS`).
4. **`P0.4` CSP y Signing Android (`231e7f9` + `b285688`):** CSP de producción actualizada en `vercel.json`, `minifyEnabled true` y lectura segura de `hasReleaseSigning` en `android/app/build.gradle`.

### 2.3. Brechas y Deuda Restante que Aborda Este Milestone
De acuerdo con el mapeo en `.planning/codebase/`:
- **`P1.1` Estado Cron Mezclado con Presupuestos:** `api/cron-reminder.js` almacena registros sentinela (`__cron_fixed_expenses__`, `__cron_reminder_7pm__`) dentro de `category_budgets`, y los presupuestos eliminados pueden resurgir desde `localStorage`.
- **`P1.2` Datos Desactualizados y Bugs en Realtime/TC:** `ResumenService.loadYearSummary()` no se invalida tras mutaciones de gastos/ingresos; `TcService` omite `lastLocalMutationTime = Date.now()` en `updateTcExpense()`/`deleteTcExpense()`, pierde campos USD en undo y solo guarda tarjetas eliminadas en `localStorage` (`STORAGE_DELETED_CARDS_KEY`).
- **`P1.3` Tipado Estricto Pendiente y Deuda `PLAN.md` 2.9:** `tsconfig.json` aún no habilita `"strict": true` globalmente (pese a figurar como regla en `CONTEXT.md`), existen **81 advertencias `@typescript-eslint/no-explicit-any`** en código productivo y `eslint.config.mjs` carece de `ignores` para `android/**`, `dist/**` y `.planning/**`. Además falta validar la longitud de tags `[Deuda: ...]` / `[Evento: ...]` en `ExpenseFormModal` y cerrar la tarea `2.9` de `PLAN.md`.
- **`P1.4` Esquema SQL Fragmentado e Higiene:** Hay 30 archivos `.sql` sueltos en `supabase/` sin carpeta `migrations/`, diferencias entre scripts (`UUID`/`TEXT`, `smallint`/`INTEGER`, `CHECK`s) y referencias/datos reales hardcoded en scripts SQL y en `bancolombia-sync.gs`.
- **Migración Auth de Bancolombia Sync:** `automation/bancolombia-sync/bancolombia-sync.gs` está activo y operativo, pero actualmente utiliza `SUPABASE_SERVICE_ROLE_KEY` desde `ScriptProperties` para escribir directo en Supabase REST. Debe migrarse a un endpoint dedicado `api/bancolombia-sync.js` autenticado con secreto compartido.
- **Estabilidad `P2` Seleccionada:** Faltan pruebas unitarias de la lógica de `api/cron-reminder.js` (y su integración junto con `npx tsc --noEmit` en GitHub Actions), rollback optimista estandarizado con toast y confirmación no bloqueante (retirando `confirm()`), y limpieza determinista de canales Realtime/timers con `DestroyRef` + eliminación de la carrera de auto-migración en `ExpensesService`.

---

## 3. Gobernanza SDD y Convivencia Documental (Opción A)

Este proyecto adopta un modelo de convivencia clara entre la documentación existente y `.planning/`:

| Artefacto | Rol en el Proyecto |
| :--- | :--- |
| `CONTEXT.md` y `.antigravity/rules.md` | **Fuente permanente** de arquitectura, reglas de negocio, convenciones Angular/TypeScript y **Zonas Prohibidas / Delicadas** (`tc.service.ts`, `push-notification.service.ts`, `expense-form-modal.ts`, `projects.service.ts`, `debts.service.ts`, `supabase-auth.service.ts`, `scripts/set-env.js`). |
| `.planning/PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` | **Fuente activa de planificación y ejecución** del milestone actual (fases, requerimientos verificables y estado vivo). |
| `.planning/codebase/*.md` | Línea base de auditoría arquitectónica, integraciones, convenciones, pruebas y deuda técnica. |
| `PLAN.md` y `SUMMARY.md` | **Bitácora histórica** de las oleadas Wave 0–2 (con el único pendiente de la tarea `2.9` integrado y cerrado en la Fase 3 de este roadmap). |

**Regla de Seguridad en Zonas Delicadas:** Toda intervención en `tc.service.ts` (Fase 2) o `expense-form-modal.ts` (Fase 3) debe ir precedida o acompañada de pruebas unitarias de caracterización/regresión que validen cero alteración de la matemática FIFO, la división 50/50 o los flujos cruzados de deuda/proyecto/TC.

---

## 4. Objetivos Medibles del Milestone

1. **Separar completamente el estado operativo de crons de los datos de presupuesto** e impedir la resurrección local de presupuestos eliminados, con cobertura unitaria de `api/cron-reminder.js` ejecutándose en CI.
2. **Garantizar consistencia inmediata entre vistas, Realtime y estado optimista**, corrigiendo los bugs conocidos de `ResumenService` y `TcService`, limpiando canales Realtime con `DestroyRef` y estandarizando rollback + toast sin `confirm()`.
3. **Alcanzar `"strict": true` completo en `tsconfig.json` y `0` usos de `any` en código productivo**, elevando `@typescript-eslint/no-explicit-any` a `'error'`, protegiendo tags de descripción y habilitando gates automáticos de `tsc` y `api/*.test.mjs` en GitHub Actions.
4. **Unificar la base de datos en migraciones versionadas (`supabase/migrations/`)**, sanear datos/IDs reales de scripts versionados y **retirar `SUPABASE_SERVICE_ROLE_KEY` de Google Apps Script** mediante `api/bancolombia-sync.js`.

---

## 5. Fuera de Alcance (*Out of Scope*)

Quedan explícitamente diferidos para un milestone posterior:
- Refactorización de arquitectura de notificaciones y alertas (`FixedExpenseAlertsService` + `NOTIFICATION_PROVIDER` en runtime, filtrado de `recipientId` en `api/notify.js`, desacoplamiento de `PushNotificationService`, reemplazo de `[CARD:...]`/`"Gas"` por llaves foráneas, unificación de cálculo de vencimiento cron/cliente y webhook DB duplicado).
- Parches incrementales de Realtime en reemplazo de recargas por tabla y configuración de *lazy routes* en `src/app/app.routes.ts`.
- Todo el bloque `P3` de `CONCERNS.md` (consolidación GitHub Actions vs GitLab CI o crons duplicados, retiro de `SplashScreen`, duplicados de `config.json`/`formatCOP`, scripts one-off, binarios `HUS/`, ajuste de versión compat del service worker Firebase).
- Nuevas funcionalidades de negocio en módulos existentes o nuevos módulos.
