HU-008: Control Estricto de Presupuestos vía Firebase Remote Config (Fase 2)
ID: HU-008
Título: Gestión Centralizada de Presupuestos Inmutables y Alertas Visuales con Remote Config
Épica: Notificaciones y Control Presupuestal
Fase de Ejecución: Fase 2
Historia de Usuario
Como administrador financiero del hogar,
Quiero que los límites de presupuesto y las reglas de alerta se gestionen de forma centralizada desde Firebase Remote Config sin opción de alteración impulsiva desde la app,
Para garantizar disciplina en los topes acordados y recibir alertas visuales en tiempo real cuando el consumo alcance umbrales críticos.
Criterios de Aceptación Funcionales y Técnicos
1. Integración de Firebase Remote Config SDK
	Criterio 1.1: La aplicación web deberá inicializar el SDK modular de Firebase Remote Config (@angular/fire / @firebase/remote-config) al arrancar el cliente.
	Criterio 1.2: Configuración de política de caché/fetch:
	minimumFetchIntervalMillis: Definido en 3600000 (1 hora) para entorno de producción o 0 durante pruebas/desarrollo.
	Establecer valores por defecto (Default Config Map) dentro del código fuente para garantizar tolerancia a fallos si el cliente está fuera de línea.
2. Definición y Descarga de Parámetros de Control
	Criterio 2.1: El cliente deberá consumir obligatoriamente los siguientes parámetros configurados en la consola de Firebase:
Clave del Parámetro	Tipo	Valor Inicial Sugerido	Descripción
daily_reminder_hour	Number	20	Hora militar para el disparador del recordatorio diario (ej.: 20 = 8:00 PM).
daily_reminder_message	String	"No olvides reportar los gastos de hoy"	Texto personalizable para la alerta del recordatorio.
budget_hogar	Number	2500000	Límite mensual máximo para el rubro Hogar.
budget_alimentacion	Number	2000000	Límite mensual para Supermercado / Alimentación.
budget_restaurantes	Number	1000000	Límite mensual para Salidas y Restaurantes.
budget_transporte	Number	800000	Límite mensual para Gasolina / Transporte.
budget_entretenimiento	Number	500000	Límite mensual para Cine / Ocio.
alert_threshold_pct	Number	80	Porcentaje sobre el tope para disparar la alerta preventiva.
enable_push_alerts	Boolean	true	Interruptor global para encender o pausar las alertas push.
3. Inmutabilidad en UI y Evaluación de Consumo
	Criterio 3.1 (Bloqueo de Modificación Local): Los campos de tope presupuestal en las pantallas de la app serán de sólo lectura (read-only), eliminando cualquier control o botón que permita modificar los límites desde la interfaz de gasto diario.
	Criterio 3.2 (Indicadores Visuales por Categoría):
	En la pantalla "Por Categoría", la barra de progreso de cada rubro calculará su estado contra el parámetro de Remote Config respectivo:
	Consumo < 80%: Color normal de la categoría / primario.
	Consumo ≥ 80% (alert_threshold_pct): Color Ámbar / Naranja (Preventivo).
	Consumo ≥ 100%: Color Rojo (Excedido).
Especificaciones Técnicas
	SDK: import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';
	Inyección en Estado Global: Los valores obtenidos de Remote Config deben inyectarse en el estado de la aplicación (ej. Redux / NgRx / BehaviorSubject) para reaccionar dinámicamente sin recalcular en cada vista.
