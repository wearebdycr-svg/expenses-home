# PLAN.md - Plan de Estabilización y Refactorización

## Wave 0: Red de Seguridad y Diagnóstico
- [X] 0.1 Diagnóstico de tipos y linter: ejecutar compilación estática y listar advertencias/errores sin modificar la lógica.
- [X] 0.2 Pruebas de humo críticas: crear 1 o 2 tests básicos que confirmen que la lógica central actual sigue funcionando intacta.

## Wave 1: Modularización Atómica
- [X] 1.1 Extraer la lógica de negocio dispersa del componente/archivo principal hacia un módulo/servicio independiente.
- [X] 1.2 Añadir tipado estricto a las entradas y salidas de datos de ese módulo extraído.
- [X] 1.3 Verificar que el flujo original funcione sin cambios visuales ni regresiones.

## Wave 2: Alertas de Vencimiento de Gastos Fijos con Notificaciones Push

### Fase 2.A: Contratos y Modelos de Datos (Bajo Acoplamiento)
- [X] 2.1 Extender contrato de modelo en `src/app/features/gastos-fijos/data/fixed-expense.model.ts` incorporando `dia_limite_mes` (entero 1..31), `dias_anticipacion_alerta` (entero >= 0) y los tipos formales `GastoFijoAlerta`, `EstadoVencimiento` y `ResultadoCalculoVencimiento`.
- [X] 2.2 Definir la interfaz de abstracción del puerto `NotificationProvider` junto con `NotificationPayload` y `NotificationResult` en `src/app/core/notifications/notification-provider.interface.ts` desacoplada de SDKs de terceros.

### Fase 2.B: Lógica Pura y Pruebas Unitarias (TDD / Core Aislado)
- [X] 2.3 Crear suite de pruebas unitarias en `src/app/features/gastos-fijos/utils/due-date-calculator.spec.ts` validando exhaustivamente: regla de clamping para fin de mes (días 28, 29, 30, 31 y bisiestos), cambio de año calendario, invariancia ante diferentes horas del día e inmutabilidad de parámetros.
- [X] 2.4 Implementar la función pura `calcularVencimientoGastoFijo()` en `src/app/features/gastos-fijos/utils/due-date-calculator.ts` con normalización temporal UTC/civil agnóstica de zonas horarias, asegurando el 100% de cobertura en la suite de pruebas unitarias.

### Fase 2.C: Despachador de Alertas y Adaptadores (Inversión de Dependencias)
- [ ] 2.5 Implementar adaptador concreto para notificaciones (`FcmNotificationAdapter` / `WebPushNotificationAdapter`) bajo el contrato `NotificationProvider` en `src/app/core/notifications/adapters/`.
- [ ] 2.6 Desarrollar el servicio orquestador de alertas de gastos fijos (`fixed-expense-alerts.service.ts`) que evalúe la colección de gastos activos mediante la función pura y despache alertas a través de `NotificationProvider`, acompañado de pruebas unitarias con `MockNotificationProvider`.

### Fase 2.D: Integración con Crons/Endpoints y Capa de Presentación (Mayor Acoplamiento)
- [ ] 2.7 Actualizar / extender la función serverless de recordatorios en `api/cron-reminder.js` (o endpoint dedicado) para orquestar la verificación periódica de vencimientos y envío push en segundo plano.
- [ ] 2.8 Actualizar la interfaz de usuario en `src/app/features/gastos-fijos` (componentes de modal/formulario y vista de lista/matriz) para permitir capturar `dia_limite_mes` y `dias_anticipacion_alerta`, visualizando badges de estado de vencimiento (`al_dia`, `proximo`, `vence_hoy`, `vencido`).
- [ ] 2.9 Verificación integral de calidad: ejecutar verificación de tipos (`tsc --noEmit`), suite completa de pruebas unitarias (`ng test`), análisis estático ESLint y confirmación de 0 regresiones sobre la base existente.
