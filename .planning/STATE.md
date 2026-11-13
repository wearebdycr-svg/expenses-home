# STATE.md — Estado Vivo del Proyecto

> **Fecha de actualización:** 2026-11-12  
> **Milestone activo:** Estabilización Técnica, Confiabilidad y Seguridad Operativa  
> **Fase actual:** **Fase 1 completada y verificada** (Listo para planificar Fase 2)

---

## 1. Posición Actual

- **Git / Ambientes:** Rama `develop` con Fase 1 ejecutada (listo para commit y push).
- **Base de Datos Supabase:** `supabase/security_hardening_rls.sql` ejecutado en DEV y PROD; `supabase/cron_executions_schema.sql` listo para ejecutar en Supabase SQL Editor.
- **Automatizaciones Externas:** `automation/bancolombia-sync/bancolombia-sync.gs` operativo en producción (migración a `api/bancolombia-sync.js` programada para **Fase 4**).
- **CI/CD Principal:** GitHub Actions (`.github/workflows/tests.yml` actualizado con `typecheck` y `test:api`).

### Progreso por Fase
- [x] **Fase 1:** Integridad de Presupuestos, Estado Cron y Cobertura `api/` (`REQ-CRON-01`, `REQ-BUD-01`, `REQ-TEST-01`, `REQ-CI-01`)
  - [x] `01-01-PLAN.md`: Aislamiento en `cron_executions`, tests serverless y gates CI
  - [x] `01-02-PLAN.md`: Filtrado de sentinelas y no-resurrección de presupuestos en `RemoteConfigService`
- [ ] **Fase 2:** Sincronización Realtime, Rollback Optimista y Resumen Anual (`REQ-SYNC-01`, `REQ-SYNC-02`, `REQ-RT-01`, `REQ-UX-01`, `REQ-UX-02`)
- [ ] **Fase 3:** Tipado Estricto Progresivo, ESLint y Cierre `PLAN.md` 2.9 (`REQ-LINT-01`, `REQ-VAL-01`, `REQ-TS-01`, `REQ-TS-02`)
- [ ] **Fase 4:** Migraciones SQL Versionadas, Higiene de Scripts y Auth Bancolombia Sync (`REQ-DB-01`, `REQ-HYG-01`, `REQ-SEC-01`)

---

## 2. Línea Base Técnica Verificada (Post-Fase 1, `2026-11-12`)

Resultados observados tras la ejecución de la Fase 1:

| Verificación | Comando | Resultado Actual | Notas |
| :--- | :--- | :--- | :--- |
| **Compilación TS** | `npm run typecheck` (`npx tsc --noEmit`) | **0 errores** | Compilación estática limpia. |
| **Tests Serverless** | `npm run test:api` (`node --test api/*.test.mjs`) | **14/14 pasando** (2 suites, 182 ms) | 8 tests de `security.test.mjs` + 6 tests de `cron-reminder.test.mjs`. |
| **Tests Frontend** | `HOME=/tmp npx ng test --watch=false` | **346/346 pasando** (60 archivos) | +5 tests en `remote-config.service.spec.ts` con cobertura de sentinelas y no-resurrección. |
| **Linter / SAST** | `HOME=/tmp npm run lint` | **0 errores, 118 advertencias** | Cero errores, -3 advertencias frente a línea base. |
| **Build Producción**| `HOME=/tmp npm run build` | **0 errores (Exit code 0)** | Bundle generado exitosamente en `dist/expenses-home` (1.39 MB). |

---

## 3. Decisiones Confirmadas Durante el Onboarding

1. **Enfoque del Milestone:** 100 % estabilización y confiabilidad (`P1.1`–`P1.4`, estabilidad Realtime, rollback optimista, tests de cron y auth de Bancolombia Sync); cero features nuevas.
2. **Convivencia SDD (Opción A):** `CONTEXT.md` y `.antigravity/rules.md` permanecen como reglas permanentes de negocio/arquitectura y Zonas Delicadas; `.planning/` gobierna el milestone actual; `PLAN.md` y `SUMMARY.md` quedan como referencia histórica salvo el cierre de la tarea `2.9` en Fase 3.
3. **Estrategia `Bancolombia Sync`:** Opción A — nuevo endpoint serverless `api/bancolombia-sync.js` autenticado con secreto compartido (`BANCOLOMBIA_SYNC_SECRET`) para eliminar `SUPABASE_SERVICE_ROLE_KEY` de Google Apps Script en **Fase 4**.
4. **TypeScript `strict: true`:** Activación en **2 sub-etapas** dentro de **Fase 3** (Sub-etapa 1: eliminar `any`, pasar `no-explicit-any` a `'error'`, excluir `android/**`/`dist/**`/`.planning/**`, flags sin nullability; Sub-etapa 2: `strictNullChecks` + `"strict": true` y cierre `PLAN.md` 2.9).
5. **Gates en CI (`tests.yml`):** Incorporar `node --test api/*.test.mjs` y `npx tsc --noEmit` al workflow de pruebas de GitHub Actions en **Fase 1**.
6. **Manejo de Errores y Confirmaciones:** Rollback optimista estandarizado con notificación vía `ToastService` y retiro de `confirm()`/`window.confirm()` nativos en **Fase 2**.
7. **Exclusiones Explícitas:** Refactorización arquitectónica de notificaciones/alertas (`NOTIFICATION_PROVIDER`, FKs en lugar de `[CARD:...]`/`"Gas"`, webhook DB), parches incrementales Realtime, *lazy routes* y todo el bloque `P3` quedan *Out of Scope*.

---

## 4. Riesgos y Puntos de Atención al Arrancar Fase 1

- **Despliegue coordinado de `cron_executions`:** Al migrar `api/cron-reminder.js` fuera de `category_budgets`, las instancias DEV y PROD en Supabase deben ejecutar el DDL de `public.cron_executions` (y migrar o limpiar `__cron_fixed_expenses__` / `__cron_reminder_7pm__` existentes) antes o junto con el despliegue de Vercel para no provocar doble disparo en la transición.
- **Compatibilidad ESM en `api/*.js`:** Al ejecutar `node --test api/security.test.mjs`, Node emite aviso `MODULE_TYPELESS_PACKAGE_JSON` porque `package.json` no declara `"type": "module"`; tenerlo presente al diseñar `api/cron-reminder.test.mjs` para que no afecte imports ni herramientas Angular.
- **Zonas Delicadas en Fases 2 y 3:** `tc.service.ts` (Fase 2) y `expense-form-modal.ts` (Fase 3) requieren pruebas de caracterización antes/durante su modificación conforme a `CONTEXT.md`.

---

## 5. Siguiente Paso Inmediato

Iniciar planificación y ejecución de la **Fase 2 (`REQ-SYNC-01`, `REQ-SYNC-02`, `REQ-RT-01`, `REQ-UX-01`, `REQ-UX-02`)**:
1. Planificar la Fase 2 con `/gsd-plan-phase 2`.
2. Preparar pruebas de caracterización en `tc.service.spec.ts` antes de modificar `TcService` (Zona Crítica).
3. Diseñar componente/servicio reutilizable para reemplazo de `confirm()` nativo y estandarizar rollback optimista con `ToastService`.
