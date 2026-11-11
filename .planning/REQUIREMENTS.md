# REQUIREMENTS.md — Requerimientos del Milestone de Estabilización

> **Proyecto:** Finanzas Hogar (`expenses-home`)  
> **Última actualización:** 2026-11-11  
> **Criterio general:** Todo requerimiento debe ser verificable mediante inspección estática, prueba automatizada (Vitest / `node --test`) o verificación SQL reproducible.

---

## 1. Requerimientos Funcionales y Técnicos

### 1.1. Estado de Cron, Presupuestos y Cobertura `api/` (Fase 1)

| ID | Requerimiento | Criterios de Aceptación Medibles |
| :--- | :--- | :--- |
| **`REQ-CRON-01`** | **Aislar estado de crons fuera de `category_budgets`:** Mover las marcas de ejecución `__cron_fixed_expenses__` y `__cron_reminder_7pm__` fuera de `public.category_budgets` hacia una tabla dedicada `public.cron_executions`. | 1. Existe SQL idempotente que crea `public.cron_executions` (clave de trabajo, fecha/marca de última ejecución, metadatos y `updated_at`), habilita RLS y revoca permisos a `anon`.<br>2. `api/cron-reminder.js` lee y actualiza únicamente `cron_executions` para controlar idempotencia diaria.<br>3. No se escriben ni consultan filas `__cron_*` en `category_budgets`. |
| **`REQ-BUD-01`** | **Consistencia de presupuestos en cliente:** Filtrar sentinela `__cron_*` y evitar resurrección de presupuestos eliminados desde `localStorage`. | 1. `RemoteConfigService.loadBudgetsFromDb()` descarta defensivamente cualquier fila cuyo identificador/categoría comience por `__cron_`.<br>2. Eliminar un presupuesto actualiza y limpia la caché en `localStorage` de forma que recargar la página o caer en fallback offline no vuelva a restaurar el presupuesto borrado.<br>3. Tests unitarios en `remote-config.service.spec.ts` cubren ambos casos. |
| **`REQ-TEST-01`** | **Tests unitarios de `api/cron-reminder.js`:** Crear suite dedicada (`api/cron-reminder.test.mjs`) con `node --test`. | 1. Cubre evaluación de gastos fijos próximos/vencidos hoy, recordatorio diario, control de idempotencia sobre `cron_executions` (no re-disparar mismo día/ventana) y respuestas ante fallo de dependencias.<br>2. Se ejecuta 100 % offline con mocks/stubs sin llamar a Supabase ni FCM reales.<br>3. Todos los casos nuevos y los 8 existentes de `api/security.test.mjs` pasan con `node --test api/*.test.mjs`. |
| **`REQ-CI-01`** | **Gates automáticos en GitHub Actions:** Ejecutar `api/*.test.mjs` y `tsc --noEmit` en `.github/workflows/tests.yml`. | 1. `.github/workflows/tests.yml` ejecuta además de `npm run test:ci`: `npx tsc --noEmit` y `node --test api/*.test.mjs`.<br>2. Cualquier fallo en tipado estático o en pruebas serverless hace fallar el job `unit-tests` del workflow. |

---

### 1.2. Sincronización Realtime, Rollback Optimista y Resumen Anual (Fase 2)

| ID | Requerimiento | Criterios de Aceptación Medibles |
| :--- | :--- | :--- |
| **`REQ-SYNC-01`** | **Frescura de Resumen Anual tras mutaciones:** Refrescar o invalidar `ResumenService.loadYearSummary()` cuando cambien gastos o ingresos. | 1. Agregar, editar o eliminar registros en `ExpensesService` o `IncomesService` dispara actualización/invalidación coherente del resumen anual sin requerir recarga manual del navegador.<br>2. Test unitario demuestra que el resumen refleja la mutación posterior en gastos/ingresos. |
| **`REQ-SYNC-02`** | **Corrección de bugs en `TcService` (Zona Crítica):** Evitar ecos Realtime, preservar USD al deshacer y sincronizar borrado de tarjetas. | 1. `TcService.updateTcExpense()` y `TcService.deleteTcExpense()` asignan `lastLocalMutationTime = Date.now()` antes/junto con la mutación remota para suprimir recargas eco.<br>2. La función de deshacer en `deleteTcExpense()` preserva íntegramente `currency`, `amountUsd` y `exchangeRate`.<br>3. La eliminación de tarjetas se persiste/sincroniza en la tabla `tc_cards` en Supabase (no solo en `STORAGE_DELETED_CARDS_KEY`), evitando que reaparezcan en otros dispositivos.<br>4. Tests unitarios de caracterización en `tc.service.spec.ts` verifican estos 3 comportamientos + invariantes FIFO/cuotas sin regresiones. |
| **`REQ-RT-01`** | **Estabilidad de ciclo de vida Realtime y carga inicial:** Limpiar suscripciones/timers con `DestroyRef` y eliminar carrera de auto-migración. | 1. Los servicios con canales Supabase Realtime, `setInterval` o listeners del navegador registran limpieza explícita (`supabase.removeChannel`, `clearInterval`, `removeEventListener`) con `DestroyRef` o guardas anti-duplicación al re-suscribir.<br>2. Se elimina o serializa con candado idempotente la auto-migración en `ExpensesService.loadExpenses()` para que sesiones concurrentes no dupliquen ni corrompan escrituras durante el arranque.<br>3. Tests unitarios verifican limpieza de canales/listeners y ausencia de doble migración concurrente. |
| **`REQ-UX-01`** | **Rollback optimista estandarizado + Toast en error:** Revertir estado local y notificar al usuario cuando falle Supabase. | 1. Todas las operaciones optimistas (`add`/`update`/`delete`) en `ExpensesService`, `IncomesService`, `TcService`, `DebtsService`, `ProjectsService`, `FixedExpensesService` y `CategoriaService` guardan snapshot previo del signal antes de mutar.<br>2. Ante error de red o rechazo de Supabase/RLS, restauran el snapshot previo en signals/`localStorage` y muestran mensaje claro de error vía `ToastService` (sin perder datos en silencio).<br>3. Tests unitarios simulan error de Supabase y comprueban restauración exacta del estado + invocación de toast. |
| **`REQ-UX-02`** | **Eliminar diálogos `confirm()` bloqueantes:** Reemplazar `confirm()` / `window.confirm()` por confirmación no bloqueante en UI. | 1. Se reemplazan las llamadas nativas bloqueantes en UI (`gastos-fijos.ts`, `proyectos.ts`, `tc.ts`, `tc-cards-grid.ts`, `tc-table.ts`, `debt-table.ts`, `income-table.ts`, `expense-table.ts`) por un diálogo/confirmación reutilizable dentro de la aplicación.<br>2. `grep -rn "confirm(" src/app/` devuelve `0` coincidencias de `confirm()`/`window.confirm()` nativo (salvo pruebas si aplica).<br>3. El guardado/eliminación en `GastosFijosPage` maneja errores mostrando feedback vía `ToastService`. |

---

### 1.3. Tipado Estricto Progresivo, ESLint y Cierre `PLAN.md` 2.9 (Fase 3)

| ID | Requerimiento | Criterios de Aceptación Medibles |
| :--- | :--- | :--- |
| **`REQ-LINT-01`** | **Higiene ESLint y erradicación de `any`:** Configurar exclusiones y eliminar las 81 advertencias actuales de `no-explicit-any` en código productivo. | 1. `eslint.config.mjs` incluye `ignores` explícitos para `android/**`, `dist/**` y `.planning/**` (permitiendo ejecutar `npx eslint .` sin errores sobre artefactos generados).<br>2. `src/app/**/*.ts` (excluyendo `*.spec.ts`) tiene `0` ocurrencias de `any` explícito.<br>3. `@typescript-eslint/no-explicit-any` pasa de `'warn'` a `'error'` en `eslint.config.mjs` para código fuente productivo.<br>4. `HOME=/tmp npm run lint` termina con `0` errores y `0` advertencias de `no-explicit-any`. |
| **`REQ-VAL-01`** | **Integridad de tags `[Deuda: ...]` y `[Evento: ...]` en `ExpenseFormModal` (Zona Crítica):** Validar longitud antes de truncar descripciones. | 1. `ExpenseFormModal` (`src/app/features/gastos/components/expense-form-modal/expense-form-modal.ts`) calcula y reserva la longitud del prefijo/sufijo `[Deuda: ...]` / `[Evento: ...]` antes de truncar el texto libre, evitando tags rotos o truncados que rompan el enlace lógico.<br>2. `expense-form-modal.spec.ts` incluye casos de borde con descripciones largas que exceden el límite junto con tags de deuda y evento. |
| **`REQ-TS-01`** | **TypeScript estricto — Sub-etapa 1 (sin null-checks):** Activar flags de tipado fuerte de valores y funciones en `tsconfig.json`. | 1. Se habilitan en `tsconfig.json` `noImplicitAny`, `strictFunctionTypes`, `strictBindCallApply` y `useUnknownInCatchVariables`.<br>2. `npx tsc --noEmit` y compilación app/spec completan con `0` errores. |
| **`REQ-TS-02`** | **TypeScript estricto — Sub-etapa 2 (`"strict": true`) y cierre `PLAN.md` 2.9:** Habilitar modo estricto completo y cerrar verificación integral. | 1. `tsconfig.json` contiene `"strict": true` activo (incluyendo `strictNullChecks`, `strictPropertyInitialization`, `alwaysStrict`).<br>2. `npx tsc --noEmit`, `HOME=/tmp npm run lint`, `HOME=/tmp npx ng test --watch=false`, `node --test api/*.test.mjs` y `HOME=/tmp npm run build` completan con `0` errores y `0` regresiones.<br>3. La tarea `2.9` de `PLAN.md` queda marcada como completada `[X]` con referencia de verificación. |

---

### 1.4. Migraciones SQL Versionadas, Higiene de Scripts y Auth Bancolombia (Fase 4)

| ID | Requerimiento | Criterios de Aceptación Medibles |
| :--- | :--- | :--- |
| **`REQ-DB-01`** | **Migraciones versionadas en `supabase/migrations/`:** Reconciliar esquema actual en archivos ordenados y reproducibles. | 1. Existe directorio `supabase/migrations/` con migraciones secuenciales que consolidan tablas base, `category_budgets`, `cron_executions`, `fcm_tokens`, `debts`, `tc_cards`, `tc_expenses`, `projects`, `project_expenses`, `fixed_expenses`, vista `v_monthly_summary` y políticas RLS vigentes.<br>2. Se unifican discrepancias conocidas entre scripts históricos (`UUID` vs `TEXT`, `smallint` vs `INTEGER` en `dia_limite_mes` / `dias_anticipacion_alerta`, constraints `CHECK` alineados con `CONTEXT.md` sección 7.1).<br>3. Los scripts legacy sustituidos quedan documentados o marcados claramente para no aplicarse sobre el esquema unificado. |
| **`REQ-HYG-01`** | **Limpieza de datos personales e IDs reales en scripts:** Remover valores sensibles o referencias hardcoded de producción del repositorio. | 1. Se eliminan balances personales, montos reales privados e IDs/URLs hardcoded específicos de producción en archivos `.sql` versionados (en especial `fix_all_tables_rls_and_schemas.sql` y `populate_prod_from_dev.sql`) y en `automation/bancolombia-sync/bancolombia-sync.gs` (reemplazándolos por placeholders o `ScriptProperties`).<br>2. Auditoría textual sobre `supabase/` y `automation/` confirma ausencia de credenciales o datos reales personales. |
| **`REQ-SEC-01`** | **Migración auth de Bancolombia Sync sin `service_role` en Apps Script:** Crear endpoint `api/bancolombia-sync.js` protegido por secreto compartido. | 1. Se implementa `api/bancolombia-sync.js` usando utilidades de `api/_security.js`: valida método HTTP, compara `BANCOLOMBIA_SYNC_SECRET` en tiempo constante (`timingSafeEqualSecret`), valida y acota tabla destino permitida (`expenses`, `incomes`, `tc_expenses`), deduplica y escribe vía `SUPABASE_SERVICE_ROLE_KEY` únicamente del lado servidor Vercel.<br>2. `automation/bancolombia-sync/bancolombia-sync.gs` elimina toda lectura/envío de `SUPABASE_SERVICE_ROLE_KEY` y llama exclusivamente a `/api/bancolombia-sync` enviando el header de autorización con `BANCOLOMBIA_SYNC_SECRET`.<br>3. Tests en `api/bancolombia-sync.test.mjs` (o extensión de `api/*.test.mjs`) verifican rechazo `401/403` sin secreto o tabla inválida, deduplicación e inserción válida.<br>4. Documentación en `.env.example` / guía operativa lista exactamente las `ScriptProperties` requeridas tras el cambio. |

---

## 2. Matriz de Trazabilidad Requerimiento -> Fase

| Requerimiento | Fase | Prioridad Origen | Área Principal |
| :--- | :---: | :---: | :--- |
| `REQ-CRON-01` | Fase 1 | `P1.1` | `api/cron-reminder.js` + SQL |
| `REQ-BUD-01` | Fase 1 | `P1.1` | `RemoteConfigService` |
| `REQ-TEST-01` | Fase 1 | `P2` (incluido) | `api/cron-reminder.test.mjs` |
| `REQ-CI-01` | Fase 1 | CI Gate | `.github/workflows/tests.yml` |
| `REQ-SYNC-01` | Fase 2 | `P1.2` | `ResumenService`, `ExpensesService`, `IncomesService` |
| `REQ-SYNC-02` | Fase 2 | `P1.2` | `TcService` (Zona Crítica) |
| `REQ-RT-01` | Fase 2 | `P2` (incluido) | Servicios con Realtime/Timers + `ExpensesService` |
| `REQ-UX-01` | Fase 2 | `P2` (incluido) | Servicios CRUD + `ToastService` |
| `REQ-UX-02` | Fase 2 | `P2` (incluido) | Componentes UI con `confirm()` |
| `REQ-LINT-01` | Fase 3 | `P1.3` | `eslint.config.mjs` + `src/app/**/*.ts` |
| `REQ-VAL-01` | Fase 3 | `P1.3` | `ExpenseFormModal` (Zona Crítica) |
| `REQ-TS-01` | Fase 3 | `P1.3` | `tsconfig.json` (Sub-etapa 1) |
| `REQ-TS-02` | Fase 3 | `P1.3` | `tsconfig.json` (Sub-etapa 2) + `PLAN.md` 2.9 |
| `REQ-DB-01` | Fase 4 | `P1.4` | `supabase/migrations/` |
| `REQ-HYG-01` | Fase 4 | `P1.4` | `supabase/*.sql` + `bancolombia-sync.gs` |
| `REQ-SEC-01` | Fase 4 | Seguridad Auth | `api/bancolombia-sync.js` + `bancolombia-sync.gs` |

---

## 3. Exclusiones Explícitas (*Out of Scope*)

Los siguientes elementos de `.planning/codebase/CONCERNS.md` quedan fuera de este milestone:
- **Refactorización de alertas y notificaciones (`P2` diferido):** conexión en runtime de `FixedExpenseAlertsService` + `NOTIFICATION_PROVIDER`, filtrado de `recipientId` en `api/notify.js`, desacoplamiento de `PushNotificationService` respecto de modelos de feature, unificación de cálculo de vencimiento entre cron y cliente, reemplazo de `[CARD:...]`/`"Gas"` por FKs y limpieza/autenticación del webhook `supabase/database_webhooks_notifications.sql`.
- **Optimización Realtime y routing (`P2` diferido):** parches incrementales Realtime en lugar de recargas de tabla completa, paralelización por lotes FCM en `api/` y *lazy-loaded routes* en `src/app/app.routes.ts`.
- **Mantenimiento y limpieza general (`P3` diferido):** consolidación GitHub Actions vs GitLab CI y crons duplicados, retiro de `SplashScreen`, unificación de `formatCOP` y `config.json`/`remote_config.json`, retiro de scripts one-off (`migrate-compartido.js`, `populate-dev.js`), archivo de `HUS/` y alineación de versión compat SW Firebase.
- **Nuevas funcionalidades de negocio.**
