# SUMMARY.md - Bitácora de Refactorización y Estabilización

## Wave 0: Red de Seguridad y Diagnóstico

### Tarea 0.1: Diagnóstico de Tipos y Linter
- **Fecha:** 2026-11-03
- **Estado:** Completada
- **Diagnóstico Estático:**
  - TypeScript Compiler (`tsc --noEmit` y `tsc --strict`): 0 errores sintácticos de compilación directa.
  - ESLint (`ng lint`): 0 errores, 143 advertencias registradas:
    - 95 advertencias `@typescript-eslint/no-explicit-any` concentradas en servicios de datos Supabase (`tc.service`, `expenses.service`, `debts.service`, etc.) y callbacks de Chart.js.
    - 12 advertencias `@angular-eslint/no-output-native` por nombres de outputs conflictivos con DOM nativo (`cancel`, `close`).
    - 23 advertencias de accesibilidad en plantillas HTML (eventos `click` sin soporte de teclado o `role="button"`).
    - 10 variables/imports huérfanos (`@typescript-eslint/no-unused-vars`).
    - 2 advertencias ReDoS (`security/detect-unsafe-regex`) en formateador `formatCOP`.
    - 1 falsa alarma de timing attack en `app.ts` (`security/detect-possible-timing-attacks` sobre URL hash).
  - Vitest CI: 283 pruebas unitarias pasando intactas (55 suites).
- **Hallazgos Críticos:**
  - Identificación de "God Files" que violan el invariante de 150 líneas: `tc.service.ts` (1,112 líneas), `push-notification.service.ts` (919 líneas), `expense-form-modal.ts` (795 líneas), `projects.service.ts` (786 líneas), `debts.service.ts` (641 líneas).
  - Duplicación de lógica: `formatCOP` replicado en 5 modelos diferentes.
- **Entregables:**
  - Actualización de stack y zonas protegidas en `CONTEXT.md`.
  - Reporte exhaustivo en Artifact `diagnostico-tipos-linter.md`.

### Tarea 0.2: Pruebas de Humo Críticas
- **Fecha:** 2026-11-03
- **Estado:** Completada
- **Tests Añadidos (`src/app/smoke.spec.ts`):**
  1. *Smoke Test 1 (Application Entry Point & Shell Bootstrap):* Valida inicialización de `App` (`src/main.ts`), autenticación desbloqueada, página inicial por defecto (`gastos`) y renderizado del shell (`.app-shell`, `app-sidebar`, `main.app-content`, `app-gastos-page`).
  2. *Smoke Test 2 (Core Business Pipeline - Ingestion & Aggregation):* Valida el flujo central de `ExpensesService` ingresando un gasto (`addExpense`) y verificando su reflejo en `allExpenses()`, `totalPeriod()` y `transactionCount()`.
- **Comandos de Ejecución:**
  - Aislado (solo pruebas de humo): `HOME=/tmp npx ng test --include=src/app/smoke.spec.ts --watch=false`
  - Suite completa: `HOME=/tmp npm run test:ci`
- **Resultado:** 2/2 pruebas de humo pasando (285/285 tests globales pasando en verde).
- **Entregables:**
  - Archivo de pruebas [src/app/smoke.spec.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/smoke.spec.ts).
  - Especificación en Artifact `smoke-tests-proposal.md`.

## Wave 1: Modularización Atómica

### Tarea 1.1: Extracción de Lógica de Negocio del Componente Principal
- **Fecha:** 2026-11-04
- **Estado:** Completada
- **Descripción:**
  - Se identificó la lógica de navegación, enrutamiento liviano vía URL hash, sincronización con `localStorage` y orquestación del botón físico de retroceso (Capacitor `backButton`) acoplada dentro del componente raíz `App` (`src/app/app.ts`).
  - Se extrajo dicha lógica al servicio independiente singleton [NavigationService](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/services/navigation.service.ts) (`src/app/core/services/navigation.service.ts`).
  - El componente principal `App` se redujo de 217 líneas a 105 líneas, cumpliendo el límite arquitectónico (<150 líneas) y desacoplándose de la inyección directa de `TcService` y de la gestión manual de eventos del DOM (`hashchange`).
  - Se crearon 13 pruebas unitarias exhaustivas en [navigation.service.spec.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/services/navigation.service.spec.ts) cubriendo sincronización de hash, persistencia, deselección de tarjeta TC y todos los flujos de hardware back button.
- **Validación de Regresión:**
  - Pruebas de humo críticas (`src/app/smoke.spec.ts`): 2/2 tests pasando (0 regresiones).
  - Pruebas unitarias de `App` (`src/app/app.spec.ts`): 16/16 tests pasando.
  - Pruebas unitarias de `NavigationService` (`src/app/core/services/navigation.service.spec.ts`): 13/13 tests pasando.
  - Suite completa del proyecto (`npm run test:ci`): 298/298 tests pasando (57 suites).
  - Verificación estática TypeScript (`tsc --noEmit`): 0 errores.
  - Linter (`ng lint`): 0 errores.
- **Entregables:**
  - Servicio [src/app/core/services/navigation.service.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/services/navigation.service.ts).
  - Suite [src/app/core/services/navigation.service.spec.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/services/navigation.service.spec.ts).
  - Componente refactorizado [src/app/app.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/app.ts).

### Tarea 1.2: Tipado Estricto de Entradas y Salidas de NavigationService
- **Fecha:** 2026-11-04
- **Estado:** Completada
- **Interfaces y Tipos Definitivos:**
  - `INavigationService`: Contrato explícito de interfaz pública para el servicio de navegación reactivo.
  - `isValidSidebarPage(page: string | null | undefined): page is SidebarPageId`: Type Guard estricto para desambiguar valores string procedentes del URL Hash o `localStorage`.
  - `BackButtonCustomHandler = () => boolean`: Firma de callback de entrada para interceptores de modales personalizados.
  - `BackButtonActionResult`: Unión discriminada para los valores de retorno de la jerarquía del botón de retroceso (`'pin_lock_modal_closed' | 'exit_app_locked' | 'custom_modal_closed' | 'generic_modal_closed' | 'sidebar_closed' | 'navigated_to_default' | 'exit_app_default'`).
  - `ACTIVE_PAGE_STORAGE_KEY: string` y `VALID_SIDEBAR_PAGES: readonly SidebarPageId[]`: Constantes exportadas con anotación explícita.
- **Descripción:**
  - Se definió la interfaz formal `INavigationService` y el Type Guard `isValidSidebarPage` para eliminar castings inseguros (`as SidebarPageId`).
  - Se crearon tipos explícitos para callbacks de entrada (`BackButtonCustomHandler`) y tipos de retorno deterministas (`BackButtonActionResult`).
  - Se anotaron explícitamente todos los parámetros de entrada y valores de retorno de métodos públicos y privados en `NavigationService`.
  - Se expandió la suite de pruebas unitarias en `navigation.service.spec.ts` (15 tests unitarios en total) para validar el Type Guard y las salidas tipo unión de `handleHardwareBackButton`.
- **Validación de Regresión:**
  - Suite completa del proyecto (`npm run test:ci`): 300/300 tests pasando (57 suites).
  - Verificación estática TypeScript (`tsc --noEmit`): 0 errores.
  - Linter (`ng lint`): 0 errores.
- **Entregables:**
  - Contrato de tipos y Type Guard en [src/app/core/services/navigation.service.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/services/navigation.service.ts).
  - Tests unitarios actualizados en [src/app/core/services/navigation.service.spec.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/services/navigation.service.spec.ts).

### Tarea 1.3: Verificación de Flujo Original, Integración y No-Regresión E2E
- **Fecha:** 2026-11-05
- **Estado:** Completada
- **Resultados de Verificación:**
  - **Pruebas de Caracterización y Unitarias:** 300/300 tests pasando (57 suites en Vitest).
  - **Pruebas de Humo (Wave 0.2):** 2/2 tests en verde (`src/app/smoke.spec.ts`), garantizando el bootstrap del Shell principal y el pipeline de datos reactivo.
  - **Comprobación Estática de Tipos:** `tsc --noEmit` completó con 0 errores.
  - **Linter de Calidad:** `ng lint` finalizó con 0 errores (141 advertencias heredadas preexistentes sin variaciones).
  - **Compilación de Producción:** `ng build` completado exitosamente (1.36 MB bundle inicial en 6.1s).
  - **Servidor Local / Entorno de Prueba:** `ng serve` iniciado en `http://localhost:4200/` con respuesta HTTP 200 OK, carga del DOM con `<app-root>` y verificación de flujo de navegación sin alteraciones visuales ni de datos.
- **Entregables:**
  - Reporte de verificación integral en Artifact `reporte-verificacion-flujo-e2e.md`.
  - Cierre formal de la **Wave 1: Modularización Atómica** en [PLAN.md](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/PLAN.md).

### Cierre Consolidado de la Wave 1 (Modularización Atómica)
- **Modularización:** Se desacopló la lógica de navegación reactiva, persistencia en `localStorage`, sincronización con URL Hash y orquestación del botón físico de retroceso (Capacitor) hacia el nuevo servicio singleton [NavigationService](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/services/navigation.service.ts). El componente raíz [App](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/app.ts) se redujo de 217 a 105 líneas de código, satisfaciendo el invariante de arquitectura (<150 líneas) y con separación limpia de responsabilidades.
- **Tipado Estricto:** Se blindaron todas las entradas y salidas del módulo mediante la interfaz formal `INavigationService`, el Type Guard determinista `isValidSidebarPage`, la unión discriminada `BackButtonActionResult` y el tipo de callback `BackButtonCustomHandler`, erradicando aserciones no seguras (`as any` / `as SidebarPageId`).
- **Verificación y No-Regresión E2E:** Se confirmó la estabilidad absoluta del sistema con 300/300 tests unitarios en verde (incluyendo los tests de caracterización de la Wave 0), 0 errores en `tsc --noEmit`, 0 errores en `ng lint`, compilación de producción exitosa y validación en vivo del servidor local sin cambios visuales ni regresión de datos. Wave 1 concluida con éxito.

## Wave 2: Alertas de Vencimiento de Gastos Fijos con Notificaciones Push

### Tarea 2.1: Extender Contrato de Modelo en fixed-expense.model.ts
- **Fecha:** 2026-11-06
- **Estado:** Completada
- **Descripción:**
  - Se extendió el contrato de [`FixedExpense`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/data/fixed-expense.model.ts) incorporando `dia_limite_mes` (entero 1..31) y `dias_anticipacion_alerta` (entero >= 0), preservando `dueDay?: number` por compatibilidad regresiva.
  - Se definieron formalmente las entidades de dominio inmutables para el motor de alertas:
    - [`GastoFijoAlerta`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/data/fixed-expense.model.ts#L55-L65): Modelo inmutable para evaluación pura de vencimientos.
    - [`EstadoVencimiento`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/data/fixed-expense.model.ts#L67-L75): Unión discriminada de estados (`'al_dia' | 'proximo' | 'vence_hoy' | 'vencido'`).
    - [`ResultadoCalculoVencimiento`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/data/fixed-expense.model.ts#L77-L85): Contrato de salida con fecha ISO canónica y flag de notificación.
  - Se implementaron Type Guards estrictos sin uso de `any`: `isValidDiaLimiteMes`, `isValidDiasAnticipacionAlerta` e `isGastoFijoAlerta`.
- **Validación de Regresión:**
  - Compilación TypeScript (`tsc --noEmit`): 0 errores.
  - Linter ESLint sobre el modelo (`eslint fixed-expense.model.ts`): 0 errores, 0 advertencias.
  - Suite de pruebas unitarias (`npm run test:ci`): 300/300 tests pasando (57 suites).
- **Entregables:**
  - Modelo actualizado en [src/app/features/gastos-fijos/data/fixed-expense.model.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/data/fixed-expense.model.ts).
  - Tarea 2.1 marcada como completada en [PLAN.md](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/PLAN.md).

### Tarea 2.2: Definir el Puerto Abstracto NotificationProvider y DTOs
- **Fecha:** 2026-11-06
- **Estado:** Completada
- **Descripción:**
  - Se creó el puerto abstracto de notificaciones desacoplado de SDKs de terceros en [`src/app/core/notifications/notification-provider.interface.ts`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/notifications/notification-provider.interface.ts).
  - Se definieron los contratos e interfaces inmutables:
    - [`NotificationPayload`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/notifications/notification-provider.interface.ts#L6-L15): Contrato inmutable para datos de la notificación (`title`, `body`, `tag`, `data`, `priority`).
    - [`NotificationResult`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/notifications/notification-provider.interface.ts#L20-L28): Resultado estructurado con indicador de éxito, ID de mensaje, error y timestamp ISO 8601.
    - [`NotificationProvider`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/notifications/notification-provider.interface.ts#L34-L52): Puerto con métodos `sendNotification()` e `isSupported()`.
    - [`NOTIFICATION_PROVIDER`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/notifications/notification-provider.interface.ts#L57-L59): `InjectionToken<NotificationProvider>` para inyección desacoplada en Angular.
- **Validación de Regresión:**
  - Compilación TypeScript (`tsc --noEmit`): 0 errores.
  - Linter ESLint (`eslint notification-provider.interface.ts`): 0 errores, 0 advertencias.
  - Suite de pruebas unitarias (`npm run test:ci`): 300/300 tests pasando (57 suites).
- **Entregables:**
  - Archivo de contrato [src/app/core/notifications/notification-provider.interface.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/notifications/notification-provider.interface.ts).
  - Tarea 2.2 marcada como completada en [PLAN.md](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/PLAN.md).

### Tarea 2.3: Crear Suite de Pruebas Unitarias para calcularVencimientoGastoFijo
- **Fecha:** 2026-11-06
- **Estado:** Completada
- **Descripción:**
  - Se implementó la suite exhaustiva de pruebas unitarias en [`src/app/features/gastos-fijos/utils/due-date-calculator.spec.ts`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/utils/due-date-calculator.spec.ts) validando la función pura `calcularVencimientoGastoFijo`.
  - Cobertura de casos canónicos de `CONTEXT.md` (Secciones 7.2 y 7.4):
    - Regla de clamping de fin de mes (días 31/30 ajustados a 28 en febrero no bisiesto, 29 en febrero bisiesto y 30 en meses de 30 días).
    - Invariancia horaria/temporal agnóstica a zonas horarias y DST (evaluaciones a las 00:00:01, 12:00:00 y 23:59:59 arrojan idéntico `diasRestantes`).
    - Cambio de ciclo y año calendario (transiciones diciembre/enero).
    - Mapeo de la unión `EstadoVencimiento` (`'al_dia'`, `'proximo'`, `'vence_hoy'`, `'vencido'`) y flag `requiereNotificacion`.
    - Inmutabilidad estricta garantizada mediante `Object.freeze`.
  - Se creó un stub tipado en [`src/app/features/gastos-fijos/utils/due-date-calculator.ts`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/utils/due-date-calculator.ts) para la fase RED de TDD.
- **Validación de Regresión:**
  - Compilación TypeScript (`tsc --noEmit`): 0 errores.
  - Linter ESLint (`eslint due-date-calculator.spec.ts due-date-calculator.ts`): 0 errores, 0 advertencias.
  - Ejecución en Vitest (`ng test --include=...`): 14 escenarios cargados y ejecutados correctamente en ciclo TDD.
- **Entregables:**
  - Suite de pruebas [src/app/features/gastos-fijos/utils/due-date-calculator.spec.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/utils/due-date-calculator.spec.ts).
  - Archivo stub [src/app/features/gastos-fijos/utils/due-date-calculator.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/utils/due-date-calculator.ts).
  - Tarea 2.3 marcada como completada en [PLAN.md](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/PLAN.md).

### Tarea 2.4: Implementar la Función Pura calcularVencimientoGastoFijo
- **Fecha:** 2026-11-06
- **Estado:** Completada
- **Descripción:**
  - Se implementó la función matemática pura `calcularVencimientoGastoFijo` en [`src/app/features/gastos-fijos/utils/due-date-calculator.ts`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/utils/due-date-calculator.ts).
  - Cumplimiento exhaustivo de reglas de negocio (`CONTEXT.md` § 7.2):
    - **Pureza Funcional Total:** 0 llamadas a `new Date()` sin parámetros y 0 a `Date.now()`. Determinismo 100%.
    - **Normalización Temporal Canónica UTC/Civil:** Cálculo en tiempo civil canónico a mediodía (`12:00:00Z`), eliminando desvíos por husos horarios, medianoche y DST.
    - **Regla de Clamping de Fin de Mes:** `diaEfectivo = Math.min(dia_limite_mes, diasDelMes(año, mes))`. Manejo exacto de febrero común (28), bisiesto (29), años seculares (múltiplos de 400 y 100) y meses de 30 días.
    - **Mapeo Determinista de Estados:** Asignación canónica de `EstadoVencimiento` (`'al_dia'`, `'proximo'`, `'vence_hoy'`, `'vencido'`) y flag `requiereNotificacion`.
    - **Formato ISO Canónico:** Generación de `fechaLimiteCalculada` en formato estricto `YYYY-MM-DD`.
    - **Inmutabilidad Estricta:** Parámetros de entrada de solo lectura y congelación de salida mediante `Object.freeze()`.
    - **Cero Dependencias Externas:** Sin uso de `any` ni librerías externas de fechas.
- **Validación de Calidad y Regresión:**
  - Pruebas Unitarias del Módulo: 19/19 tests pasando en verde (`ng test --include=src/app/features/gastos-fijos/utils/due-date-calculator.spec.ts`).
  - Verificación Estática TypeScript: `tsc --noEmit` finalizó con 0 errores.
  - Linter ESLint: 0 errores y 0 advertencias en la implementación y su suite de pruebas.
  - Suite Completa del Proyecto: 319/319 tests unitarios pasando en verde (58 suites en `npm run test:ci`).
- **Entregables:**
  - Función pura en [src/app/features/gastos-fijos/utils/due-date-calculator.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/utils/due-date-calculator.ts).
  - Suite de pruebas enriquecida en [src/app/features/gastos-fijos/utils/due-date-calculator.spec.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/utils/due-date-calculator.spec.ts).
  - Tarea 2.4 marcada como completada en [PLAN.md](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/PLAN.md).

### Tarea 2.5: Implementar Adaptador Concreto para Notificaciones (FcmNotificationAdapter)
- **Fecha:** 2026-11-06
- **Estado:** Completada
- **Descripción:**
  - Se implementó el adaptador de infraestructura [`FcmNotificationAdapter`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/notifications/adapters/fcm-notification.adapter.ts) bajo el contrato formal [`NotificationProvider`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/notifications/notification-provider.interface.ts).
  - Características de diseño:
    - **Identidad del Puerto:** Propiedad `readonly providerName = 'fcm'`.
    - **Inyección Limpia en Angular:** Servicio decorado con `@Injectable({ providedIn: 'root' })` utilizando `inject(HttpClient)` y `firstValueFrom` de RxJS para resolución de promesas.
    - **Verificación de Canal (`isSupported`):** Detección nativa mediante `Capacitor.isNativePlatform()` y validación web con `Notification` y `serviceWorker`.
    - **Resolución de Endpoint:** Resuelve ruta relativa `/api/notify` en entorno web/testing y URL absoluta con `environment.apiUrl` en ejecución móvil nativa Capacitor.
    - **Despacho Seguro y Tolerante a Fallos (`sendNotification`):** Envía la petición HTTP POST adjuntando credenciales de autorización Bearer (`environment.supabaseAnonKey`), payload estructurado (`recipientId`, `title`, `body`, `tag`, `data`) y captura tanto errores lógicos de respuesta como fallas HTTP/red (`HttpErrorResponse`), retornando siempre `NotificationResult` con marca temporal ISO 8601 sin lanzar excepciones no controladas.
  - **Cumplimiento de Restricciones Estrictas:**
    - Se preservó intacta la zona protegida: 0 modificaciones y 0 imports desde `src/app/core/services/push-notification.service.ts`.
    - 0 uso de `any` (tipado exhaustivo y estricto).
    - Modularidad y tamaño óptimo: 106 líneas de código (invariante < 120 líneas cumplido).
  - **Suite de Pruebas Unitarias:**
    - Creada en [`fcm-notification.adapter.spec.ts`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/notifications/adapters/fcm-notification.adapter.spec.ts) con 9 casos de prueba cubriendo: inicialización, resolución de soporte nativo/web, endpoints por plataforma, despacho HTTP exitoso, captura de fallos de respuesta lógica, captura de respuestas HTTP 400/500 y errores de red `ProgressEvent`.
- **Validación de Calidad y Regresión:**
  - Pruebas Unitarias del Adaptador: 9/9 tests pasando en verde.
  - Verificación Estática TypeScript: `tsc --noEmit` completó con 0 errores.
  - Linter ESLint: 0 errores y 0 advertencias sobre el adaptador y su suite de tests.
  - Suite Global del Proyecto: 328/328 tests unitarios pasando en verde (59 suites en `npm run test:ci`).
- **Entregables:**
  - Adaptador en [src/app/core/notifications/adapters/fcm-notification.adapter.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/notifications/adapters/fcm-notification.adapter.ts).
  - Suite de pruebas en [src/app/core/notifications/adapters/fcm-notification.adapter.spec.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/core/notifications/adapters/fcm-notification.adapter.spec.ts).
  - Tarea 2.5 marcada como completada en [PLAN.md](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/PLAN.md).

### Tarea 2.6: Servicio Orquestador de Alertas de Gastos Fijos (fixed-expense-alerts.service.ts)
- **Fecha:** 2026-11-06
- **Estado:** Completada
- **Descripción:**
  - Se implementó el servicio orquestador [`FixedExpenseAlertsService`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/data/fixed-expense-alerts.service.ts) encargado de coordinar la evaluación de vencimientos de gastos fijos y el despacho seguro de alertas push.
  - **Contratos Creados e Inmutables (`fixed-expense.model.ts`):**
    - `AlertaGastoEvaluada`: Estructura inmutable resultante de confrontar un gasto fijo contra el motor de vencimiento (`gasto`, `calculo`, `requiereNotificacion`, `payload`).
    - `ResultadoDespachoAlertas`: Resumen consolidado del ciclo de despacho push (`totalEvaluadas`, `enviadas`, `fallidas`, `omitidas`, `detalles`).
  - **Arquitectura del Orquestador y Desacoplamiento Total:**
    - **Inyección por Inversión de Dependencias (DIP):** Inyecta `NOTIFICATION_PROVIDER` mediante token de abstracción opcional (`inject(NOTIFICATION_PROVIDER, { optional: true })`) e `inject(FixedExpensesService)`, garantizando desacoplamiento total de implementaciones concretas y SDKs de terceros.
    - **Composición con Función Pura:** Evalúa colecciones de gastos fijos utilizando `calcularVencimientoGastoFijo`, soportando retrocompatibilidad canónica (`dia_limite_mes ?? dueDay ?? 1` y `dias_anticipacion_alerta ?? 3`).
    - **Filtrado Inteligente de Dominio:** Omite gastos inactivos (`status !== 'activo'`) y gastos cuyo ciclo actual ya se encuentre liquidado/pagado (`idsGastosPagados`).
    - **Construcción Determinista de Payloads:** Genera títulos y cuerpos descriptivos con prioridad dinámica (`high` para `vence_hoy` y `vencido`, `normal` para `proximo`) y tags de agrupación `gasto-fijo-${id}`.
    - **Despacho Concurrente y Resiliente:** Valida disponibilidad del canal (`isSupported()`), ejecuta despachos concurrentes mediante `Promise.allSettled` y tolera fallos lógicos (`success: false`) o promesas rechazadas sin interrumpir el lote ni lanzar excepciones no controladas.
    - **Aislamiento en Testing:** Suite implementada con `MockNotificationProvider` independiente, sin acoplamiento a red ni llamadas HTTP reales.
    - **Registro en Dependencias de la App:** Configuración provista en [`src/app/app.config.ts`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/app.config.ts) enlazando `NOTIFICATION_PROVIDER` con `FcmNotificationAdapter`.
- **Métricas de Cobertura:**
  - Pruebas Unitarias del Orquestador: 9/9 tests pasando en verde ([`src/app/features/gastos-fijos/data/fixed-expense-alerts.service.spec.ts`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/data/fixed-expense-alerts.service.spec.ts)).
  - Pruebas Unitarias de Configuración: 2/2 tests pasando en verde ([`src/app/app.config.spec.ts`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/app.config.spec.ts)).
  - Total Global de Pruebas: 339 tests unitarios pasando en verde a través de 61 suites.
- **Validación de Calidad y 0 Regresiones:**
  - Compilación TypeScript (`tsc --noEmit`): 0 errores.
  - Linter ESLint (`ng lint`): 0 errores y 0 advertencias en el código nuevo y sus suites.
  - Suite de Pruebas de CI (`test:ci` / `ng test --watch=false`): 339 tests pasando (61 suites, 0 fallos).
- **Entregables:**
  - Modelos y contratos en [src/app/features/gastos-fijos/data/fixed-expense.model.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/data/fixed-expense.model.ts).
  - Servicio orquestador en [src/app/features/gastos-fijos/data/fixed-expense-alerts.service.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/data/fixed-expense-alerts.service.ts).
  - Suite de pruebas unitarias en [src/app/features/gastos-fijos/data/fixed-expense-alerts.service.spec.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/data/fixed-expense-alerts.service.spec.ts).
  - Registro de proveedor en [src/app/app.config.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/app.config.ts).
  - Pruebas de configuración en [src/app/app.config.spec.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/app.config.spec.ts).
  - Tarea 2.6 marcada como completada en [PLAN.md](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/PLAN.md).

### Tarea 2.7: Extensión de la Función Serverless Cron (api/cron-reminder.js)
- **Fecha:** 2026-11-06
- **Estado:** Completada
- **Descripción:**
  - Se extendió la función serverless de Vercel [`api/cron-reminder.js`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/api/cron-reminder.js) para orquestar la verificación periódica de vencimientos de gastos fijos y el despacho de alertas push en segundo plano.
  - **Decisiones de Diseño y Arquitectura:**
    - **Motor Matemático Canónico (`calcularVencimientoCron`):** Se integró una implementación pura e idéntica a `due-date-calculator.ts` para ejecución en runtime Node.js ESM, contemplando la regla de clamping para meses cortos (días 28, 29, 30, 31 y bisiestos) y normalización canónica UTC a mediodía (`12:00:00Z`).
    - **Conciliación de Pagos con Gastos del Mes:** Consulta en `public.expenses` para el mes actual en Colombia (`America/Bogota`) y exclusión determinista de los gastos fijos cuyo pago ya fue registrado (`category` o `description` normalizado).
    - **Deduplicación Diaria Idempotente:** Se implementó control en `public.category_budgets` bajo la clave `__cron_fixed_expenses__` con `amount: todayColombiaNum`, evitando spam de notificaciones duplicadas en ejecuciones repetidas dentro del mismo día (ignorable con `force=true`).
    - **Despacho Multicanal y Deep Linking:** Generación de payloads diferenciados (`vence_hoy`, `vencido`, `proximo`) con canal Android `finanzas_hogar_alerts`, tags únicos (`fixed-expense-${id}`) y redirección a `/#gastos-fijos`.
    - **Modos de Invocación:** Soporte para ejecución conjunta (cron programado `0 0 * * *`) o selectiva vía query params (`?type=fixed_expenses` o `?type=daily_reminder`).
    - **Limpieza Automática:** Detección y depuración de tokens FCM inválidos o desinstalados (`UNREGISTERED`, `NOT_FOUND`, etc.).
- **Validación de Calidad y 0 Regresiones:**
  - Validación sintáctica Node.js ESM: `node --check api/cron-reminder.js` finalizó con 0 errores.
  - Compilación TypeScript: `tsc --noEmit` con 0 errores.
  - Análisis estático ESLint: `HOME=/tmp npm run lint` completado con 0 errores.
  - Suite de pruebas unitarias: `HOME=/tmp npm run test:ci` pasando con 61/61 suites y 339/339 tests unitarios.
- **Entregables:**
  - Función serverless actualizada en [api/cron-reminder.js](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/api/cron-reminder.js).
  - Tarea 2.7 marcada como completada en [PLAN.md](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/PLAN.md).

### Tarea 2.8: Interfaz de Usuario de Gastos Fijos con Captura de Fechas y Badges de Vencimiento
- **Fecha:** 2026-11-06
- **Estado:** Completada
- **Descripción:**
  - Se actualizó integralmente la capa de presentación y los componentes de formulario y visualización en [`src/app/features/gastos-fijos`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos) para capturar de forma validada `dia_limite_mes` y `dias_anticipacion_alerta`, y proyectar badges visuales con el estado determinista de vencimiento (`al_dia`, `proximo`, `vence_hoy`, `vencido`).
  - **Decisiones Técnicas y Arquitectura:**
    - **Formulario Modal Reactivo ([`FixedExpenseModal`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/components/fixed-expense-modal/fixed-expense-modal.ts)):**
      - Captura de `diaLimiteMes` (entero 1..31) y `diasAnticipacionAlerta` (entero $\ge 0$, valor por defecto 3 días).
      - Erradicación absoluta de `$any` en el template mediante métodos tipados (`onNameInput`, `onDiaLimiteInput`, `onDiasAnticipacionInput`, `onNotesInput`).
      - Emisión de contratos tipados con retrocompatibilidad bidireccional (`dueDay` y `dia_limite_mes`).
    - **Cálculo de Vencimiento Integrado en Servicio ([`FixedExpensesService`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/data/fixed-expenses.service.ts)):**
      - Contrato estricto `FixedExpenseDatabaseRow` para eliminar castings no seguros.
      - Evaluación reactiva en `monthlyStatuses` usando la función pura `calcularVencimientoGastoFijo` contra la fecha de referencia del ciclo activo.
      - Persistencia en base de datos Supabase y almacenamiento local de las columnas `dia_limite_mes`, `due_day` y `dias_anticipacion_alerta`.
    - **Visualización en Tabla y Matriz Principal ([`GastosFijosPage`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/gastos-fijos.html)):**
      - Badges diferenciados por criticidad: `.vencimiento-al_dia` (verde suave con días restantes), `.vencimiento-proximo` (ámbar), `.vencimiento-vence_hoy` (naranja rojizo con pulso visual) y `.vencimiento-vencido` (rojo).
      - Columna de día límite con chip de alerta anticipada (`🔔 Xd`).
    - **Modal Rápido ([`FixedExpensesQuickModal`](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/components/fixed-expenses-quick-modal/fixed-expenses-quick-modal.html)):**
      - Estados interactivos en píldoras laterales `.pill-al_dia`, `.pill-proximo`, `.pill-vence_hoy` y `.pill-vencido` para obligaciones pendientes.
- **Validación de Calidad y 0 Regresiones:**
  - Compilación TypeScript (`tsc --noEmit`): 0 errores.
  - Linter ESLint en el módulo (`npx eslint src/app/features/gastos-fijos/`): 0 errores.
  - Pruebas Unitarias del Módulo: 43/43 tests pasando en verde (5 suites).
  - Suite Global del Proyecto: 346/346 tests pasando en verde a través de 62 suites (`ng test --watch=false`).
- **Entregables:**
  - Contrato de modelo en [src/app/features/gastos-fijos/data/fixed-expense.model.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/data/fixed-expense.model.ts).
  - Componente modal en [src/app/features/gastos-fijos/components/fixed-expense-modal/](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/components/fixed-expense-modal/).
  - Suite de pruebas de modal en [src/app/features/gastos-fijos/components/fixed-expense-modal/fixed-expense-modal.spec.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/components/fixed-expense-modal/fixed-expense-modal.spec.ts).
  - Servicio y pruebas en [src/app/features/gastos-fijos/data/fixed-expenses.service.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/data/fixed-expenses.service.ts) y [src/app/features/gastos-fijos/data/fixed-expenses.service.spec.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/data/fixed-expenses.service.spec.ts).
  - Vista principal en [src/app/features/gastos-fijos/gastos-fijos.html](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/gastos-fijos.html), [gastos-fijos.css](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/gastos-fijos.css) y [gastos-fijos.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/gastos-fijos.ts).
  - Modal rápido en [src/app/features/gastos-fijos/components/fixed-expenses-quick-modal/](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/features/gastos-fijos/components/fixed-expenses-quick-modal/).
  - Tarea 2.8 marcada como completada en [PLAN.md](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/PLAN.md).
