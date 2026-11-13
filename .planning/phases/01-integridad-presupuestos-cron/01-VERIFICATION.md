# 01-VERIFICATION.md — Verificación Técnica de la Fase 1

> **Fase:** 01 — Integridad de Presupuestos, Estado Cron y Cobertura `api/`  
> **Fecha:** 2026-11-12  
> **Estado:** **PASSED (100% de requisitos satisfechos)**  
> **Branch:** `develop`

---

## 1. Matriz de Requerimientos vs Evidencia

| Requerimiento | Descripción | Archivos Involucrados | Evidencia / Comando | Estado |
| :--- | :--- | :--- | :--- | :---: |
| **REQ-CRON-01** | Desacoplar estado de crons de `category_budgets` a `cron_executions`. | `supabase/cron_executions_schema.sql`, `api/cron-reminder.js` | `grep -rn "category_budgets" api/cron-reminder.js` retorna 0 coincidencias. DDL con RLS y limpieza idempotente. | **PASS** |
| **REQ-BUD-01** | Filtrado de sentinelas `__cron_*` y eliminación de resurrección zombi en `RemoteConfigService`. | `src/app/core/services/remote-config.service.ts`, `src/app/core/services/remote-config.service.spec.ts` | 7 tests unitarios pasando en `remote-config.service.spec.ts` validando filtrado, no-resurrección y borrado explícito con `delete current[cat]`. | **PASS** |
| **REQ-TEST-01** | Suite de pruebas unitarias serverless para `api/cron-reminder.js`. | `api/cron-reminder.test.mjs`, `package.json` | 6 tests unitarios en `cron-reminder.test.mjs` (parte de 14 tests en `npm run test:api`) cubriendo ventana horaria, deduplicación, `force=true` y resiliencia. | **PASS** |
| **REQ-CI-01** | Integrar gates automáticos de TypeScript (`tsc --noEmit`) y tests serverless en GitHub Actions. | `.github/workflows/tests.yml`, `package.json` | Pasos `TypeScript Type Check` y `Run Serverless Node Tests` añadidos en `.github/workflows/tests.yml` tras la inyección de env vars. | **PASS** |

---

## 2. Resultados de Ejecución Automatizada

### A. Tipado Estático (`npm run typecheck`)
- **Comando:** `npx tsc --noEmit`
- **Resultado:** **0 errores**. Exit code: 0.

### B. Pruebas Unitarias Serverless (`npm run test:api`)
- **Comando:** `node --test api/*.test.mjs`
- **Resultado:** **14/14 tests pasando** en 2 suites (tiempo total de ejecución: **182 ms**, 0 avisos ESM con `api/package.json`).
  - `api/cron-reminder.test.mjs` (6 tests)
    - ✔ rejects unforced invocation outside 7:00 PM Colombia window with skipped=true
    - ✔ evaluates fixed expenses when force=true, bypassing time window and deduplication
    - ✔ skips fixed expenses if cron_executions has already recorded execution for today
    - ✔ skips daily reminder if cron_executions has already recorded execution for today
    - ✔ skips daily reminder if expenses were already registered for today in Colombia
    - ✔ falls back gracefully without crashing when Supabase query fails
  - `api/security.test.mjs` (8 tests de endurecimiento de seguridad y CORS)

### C. Pruebas Unitarias Frontend Angular (`HOME=/tmp npx ng test --watch=false`)
- **Comando:** `HOME=/tmp npx ng test --watch=false`
- **Resultado:** **346/346 tests pasando** en 60 suites (0 errores o ruido de indexedDB tras guardas de testing).
  - 7 tests dedicados a `RemoteConfigService`:
    - ✔ should be created and have default config loaded
    - ✔ maps budget by category correctly
    - ✔ filters out sentinel \_\_cron_\* categories in getBudgetForCategory and budgetsByCategory
    - ✔ ignores setCategoryBudget for categories starting with \_\_cron\_
    - ✔ deletes custom budget explicitly when amount is 0 or null, avoiding zombie values
    - ✔ filters out \_\_cron_\* rows from Supabase response in loadBudgetsFromDb
    - ✔ prevents deleted budgets from resurrecting from localStorage when DB is source of truth

### D. Linter Estático (`HOME=/tmp npm run lint`)
- **Comando:** `HOME=/tmp npm run lint`
- **Resultado:** **0 errores, 118 advertencias** (Mejora frente a la línea base de 121 advertencias; 0 advertencias en código nuevo).

### E. Integridad de Presupuestos
- `api/cron-reminder.js` no contiene ninguna referencia a `category_budgets`.
- `RemoteConfigService.loadBudgetsFromDb` ignora cualquier fila con prefijo `__cron_` y usa la BD como fuente única de verdad para no revivir montos eliminados presentes en `localStorage`.

---

## 3. Veredicto Final
**Fase 1 completada y verificada exitosamente.** Todos los criterios de aceptación y calidad de los planes `01-01-PLAN.md` y `01-02-PLAN.md` están cumplidos.
