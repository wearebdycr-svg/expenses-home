# CONTEXT.md - Contrato de Rescate y Refactorización

## 1. Stack Técnico Detectado
- Lenguaje/Runtime: Angular 22 (Standalone Components + Signals), TypeScript 6.0, Capacitor 8 (Android)
- Persistencia/Base de Datos: Supabase (PostgreSQL vía `@supabase/supabase-js`), LocalStorage / Biometrics
- Estilos/UI: CSS puro modular con CSS Variables/Design Tokens, Chart.js (`ng2-charts`)
- Testing/QA: Vitest 4.0 (`@angular/build`), ESLint 10 + Angular-ESLint + ESLint Plugin Security

## 2. Invariantes y Reglas de Juego (No Negociables)
- Queda estrictamente prohibido cambiar librerías base o agregar nuevas dependencias en package.json sin aprobación explícita.
- No se permiten tipos `any` implícitos ni variables globales huérfanas.
- Modularidad: Funciones o componentes no deben superar las 150 líneas. Extraer lógica a utilidades o servicios.

## 3. Zonas Prohibidas (No-Touch Zones)
- Archivos o módulos que funcionan pero están frágiles y requieren modularización atómica previa:
  - `src/app/features/tc-compartida/data/tc.service.ts` (1,112 líneas - motor de amortización y cuotas)
  - `src/app/core/services/push-notification.service.ts` (919 líneas - sincronización y background push)
  - `src/app/features/gastos/components/expense-form-modal/expense-form-modal.ts` (795 líneas - orquestación de gastos/deudas/TC)
  - `src/app/features/proyectos/data/projects.service.ts` (786 líneas - proyectos y gastos de evento)
  - `src/app/features/deudas/data/debts.service.ts` (641 líneas - amortizaciones y prepagos)
- El agente NO debe tocar ni modificar estos archivos en las fases iniciales sin pruebas de humo previas (Wave 0.2).