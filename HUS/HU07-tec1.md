HU-007: Sistema de Feedback Inmediato y Recordatorio Diario Local de Gastos (Fase 1)
ID: HU-007

Título: Implementación de Toasts de Feedback y Recordatorio Diario de Registro de Gastos

Épica: Notificaciones y Hábito Financiero

Fase de Ejecución: Fase 1

Historia de Usuario
Como usuario del hogar (Benny / Charlie),

Quiero recibir confirmaciones visuales inmediatas sobre las acciones que realizo y un recordatorio diario vespertino si no he ingresado gastos,

Para evitar omisiones en el registro financiero diario y mantener la trazabilidad de la cuenta sin acumulaciones a fin de mes.

Criterios de Aceptación Funcionales y Técnicos
1. Sistema de Feedback Inmediato (Toasts Flotantes)
Criterio 1.1: El sistema deberá disparar notificaciones tipo Toast flotantes (duración predeterminada: 3000ms - 4000ms) en la esquina superior/inferior ante los siguientes eventos de sesión:

Creación: Confirmación exitosa al crear un gasto o ingreso.

Edición: Confirmación de actualización de un registro.

Eliminación: Confirmación de eliminación con opción opcional de deshacer (Undo).

2. Lógica del Recordatorio Diario de Gastos (Local / Web Notification API)
Criterio 2.1 (Evaluación de Actividad): A partir de un horario configurado por defecto (ej. 20:00 hrs / 8:00 PM), un servicio en frontend evaluará si existen registros de gastos realizados en la fecha actual (yyyy-MM-dd) por el usuario activo o los miembros del hogar.

Criterio 2.2 (Banner / Toast Interactivo In-App): Si no existen gastos registrados en la fecha actual al alcanzar o superar la hora límite, la aplicación desplegará un banner/toast destacado con el mensaje:

"🌙 Recordatorio diario: ¿Tuviste gastos hoy? No olvides reportarlos en FinanzasHogar para mantener las cuentas al día."

Acción 1: Botón [+ Registrar Gasto de Hoy] -> Abre directamente el modal de formulario Nuevo Gasto.

Acción 2: Botón [Hoy no gasté nada] -> Descarta la notificación por el resto de la jornada.

Criterio 2.3 (Integración con Web Notification API - Navegador):

Si el usuario otorgó permisos nativos de notificación en el navegador (Notification.permission === 'granted'), la alerta se enviará como una notificación nativa del SO/escritorio aunque la pestaña de la app no esté enfocado.

Criterio 2.4 (Persistencia en LocalStorage):

Al hacer clic en "Hoy no gasté nada" o interactuar con el recordatorio, se guardará en localStorage la clave last_daily_reminder_dismissed con el valor del día actual (yyyy-MM-dd). El sistema prevendrá repeticiones de la notificación en la misma jornada.

Especificaciones Técnicas
Frontend: Implementar un servicio DailyReminderService mediante RxJS o setInterval con ejecución periódica o activación mediante Event Listener al cargar/enfocar la ventana (window.onfocus).

Storage: localStorage.setItem('last_daily_reminder_dismissed', '2026-09-29').