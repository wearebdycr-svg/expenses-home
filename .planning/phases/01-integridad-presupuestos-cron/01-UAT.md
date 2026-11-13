# 01-UAT.md — User Acceptance Testing (Pruebas de Aceptación) Fase 1

> **Fase:** 01 — Integridad de Presupuestos, Estado Cron y Cobertura `api/`  
> **Fecha:** 2026-11-12  
> **Estado:** **ACCEPTED (Aprobado)**

---

## Escenarios de Aceptación Evaluados

### Escenario 1: Deduplicación e Idempotencia de Crons
- **Premisa:** El cron se invoca periódicamente vía Vercel Cron. No debe duplicar notificaciones en el mismo día, y su estado operativo no debe ensuciar las categorías de presupuestos de los usuarios.
- **Resultado:** APROBADO.
  - La deduplicación se realiza exclusivamente en `cron_executions` con `job_name = 'fixed_expenses'` y `job_name = 'daily_reminder_7pm'`.
  - La tabla `category_budgets` permanece limpia de sentinelas operacionales.

### Escenario 2: Resiliencia del Servicio Cron ante Fallos de Conexión
- **Premisa:** Si Supabase sufre una desconexión temporal o la tabla `cron_executions` está inaccesible, el cron debe atrapar la excepción defensivamente sin generar fallos 500 no controlados.
- **Resultado:** APROBADO.
  - Comprobado mediante simulación de rechazo en la consulta de BD en `api/cron-reminder.test.mjs` (test `falls back gracefully without crashing when Supabase query fails`).

### Escenario 3: Eliminación Permanente de Presupuestos en UI/Servicio
- **Premisa:** Cuando un usuario borra un tope presupuestal (o lo define en 0), la categoría debe desaparecer por completo y no debe resucitar al recargar la página o al sincronizarse con la base de datos.
- **Resultado:** APROBADO.
  - `setCategoryBudget` invoca `delete current[cleanCat]` eliminando la propiedad del objeto.
  - `loadBudgetsFromDb` reconstruye el mapa desde Supabase como fuente autoritativa, descartando claves obsoletas en `localStorage`.

### Escenario 4: Filtrado Defensivo contra Sentinelas en Cache Local o BD
- **Premisa:** Si existen registros residuales históricos `__cron_*` en la BD o en el `localStorage` del cliente, la interfaz jamás debe mostrarlos como categorías presupuestales.
- **Resultado:** APROBADO.
  - `getBudgetForCategory('__cron_*')` retorna `null`.
  - `budgetsByCategory` omite claves con prefijo `__cron_`.
  - `loadCustomBudgetsFromStorage` sanitiza las claves leídas de `localStorage`.

### Escenario 5: Protección del Pipeline CI
- **Premisa:** Cualquier pull request o commit debe validar estáticamente TypeScript (`tsc --noEmit`) y ejecutar los tests serverless antes de permitir despliegues.
- **Resultado:** APROBADO.
  - Verificado en `.github/workflows/tests.yml` con los pasos `TypeScript Type Check` y `Run Serverless Node Tests`.
