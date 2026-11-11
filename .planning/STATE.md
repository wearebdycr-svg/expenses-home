# STATE.md — Estado Vivo del Proyecto

> **Fecha de actualización:** 2026-11-11  
> **Milestone activo:** Estabilización Técnica, Confiabilidad y Seguridad Operativa  
> **Fase actual:** Pre-inicio de **Fase 1** (Listo para planificar y ejecutar Fase 1)

---

## 1. Posición Actual

- **Git / Ambientes:** Rama `develop` alineada con `main` en el commit `b285688` (luego del release que cerró `PinLock`/auth de 10 minutos en `bda3d3f` y corrigió el signing Gradle en `b285688`).
- **Base de Datos Supabase:** `supabase/security_hardening_rls.sql` ya ejecutado manualmente en **DEV** y **PROD**.
- **Automatizaciones Externas:** `automation/bancolombia-sync/bancolombia-sync.gs` operativo en producción (migración a `api/bancolombia-sync.js` sin `service_role` programada para **Fase 4**).
- **CI/CD Principal:** GitHub Actions (`.github/workflows/`).

### Progreso por Fase
- [ ] **Fase 1:** Integridad de Presupuestos, Estado Cron y Cobertura `api/` (`REQ-CRON-01`, `REQ-BUD-01`, `REQ-TEST-01`, `REQ-CI-01`)
- [ ] **Fase 2:** Sincronización Realtime, Rollback Optimista y Resumen Anual (`REQ-SYNC-01`, `REQ-SYNC-02`, `REQ-RT-01`, `REQ-UX-01`, `REQ-UX-02`)
- [ ] **Fase 3:** Tipado Estricto Progresivo, ESLint y Cierre `PLAN.md` 2.9 (`REQ-LINT-01`, `REQ-VAL-01`, `REQ-TS-01`, `REQ-TS-02`)
- [ ] **Fase 4:** Migraciones SQL Versionadas, Higiene de Scripts y Auth Bancolombia Sync (`REQ-DB-01`, `REQ-HYG-01`, `REQ-SEC-01`)

---

## 2. Línea Base Técnica Verificada (Commit `b285688`, `2026-11-11`)

Resultados observados antes de iniciar cambios de la Fase 1:

| Verificación | Comando | Resultado Actual | Notas |
| :--- | :--- | :--- | :--- |
| **Compilación TS** | `npx tsc --noEmit` | **0 errores** | `strict: true` aún no activado en `tsconfig.json` (objetivo Fase 3). |
| **Tests Serverless** | `node --test api/security.test.mjs` | **8/8 pasando** (1 suite) | Falta cobertura de lógica de negocio de `api/cron-reminder.js` (Fase 1). |
| **Tests Frontend** | `HOME=/tmp npx ng test --watch=false` | **341/341 pasando** (60 archivos) | Nota: existe ruido en stderr por `indexedDB is not defined` en `RemoteConfigService` al correr ciertos specs. |
| **Linter / SAST** | `HOME=/tmp npm run lint` | **0 errores, 121 advertencias** | Desglose: `81` `no-explicit-any`, `12` `no-output-native`, `10` `click-events-have-key-events`, `9` `interactive-supports-focus`, `7` `no-unused-vars`, `2` `detect-unsafe-regex`. |

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

Iniciar planificación y ejecución de la **Fase 1 (`REQ-CRON-01`, `REQ-BUD-01`, `REQ-TEST-01`, `REQ-CI-01`)**:
1. Inspeccionar en detalle `api/cron-reminder.js`, `src/app/core/services/remote-config.service.ts` y `supabase/category_budgets_schema.sql`.
2. Definir esquema SQL idempotente de `public.cron_executions` + limpieza de filas sentinela previas.
3. Refactorizar `api/cron-reminder.js` y `RemoteConfigService`, agregar `api/cron-reminder.test.mjs` y actualizar `.github/workflows/tests.yml`.
