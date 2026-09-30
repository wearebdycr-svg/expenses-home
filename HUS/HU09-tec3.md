
HU-009: Notificaciones Web Push en Tiempo Real mediante Firebase Cloud Messaging (Fase 3)
ID: HU-009
Título: Servidor de Despacho de Notificaciones Push FCM para Topes de Presupuesto y Eventos del Hogar
Épica: Notificaciones Push en Tiempo Real
Fase de Ejecución: Fase 3
Historia de Usuario
Como integrante del hogar (Benny / Charlie),
Quiero recibir notificaciones Push en mi dispositivo (móvil o escritorio) de forma instantánea cuando un rubro alcance un tope crítico o cuando el otro integrante registre un gasto compartido,
Para tomar decisiones financieras coordinadas en tiempo real sin necesidad de estar navegando activamente dentro de la aplicación.
Criterios de Aceptación Funcionales y Técnicos
1. Configuración del Service Worker de FCM
	Criterio 1.1: Implementar el archivo firebase-messaging-sw.js en la raíz del dominio público para la recepción de mensajes en segundo plano (Background Messages).
	Criterio 1.2: Compatibilidad garantizada para:
	Android (Chrome/Firefox).
	iOS (PWA instalada en Safari con iOS 16.4+).
	Desktop (Windows / macOS / Linux vía navegadores compatibles).
2. Suscripción y Gestión de Tokens FCM
	Criterio 2.1: Al iniciar sesión o aceptar permisos, la app solicitará el Token de Registro de FCM mediante getToken(messaging, { vwapKey: '...' }).
	Criterio 2.2: El token del dispositivo se registrará en el Backend en la colección de usuarios (POST /api/v1/users/fcm-token), asociando el user_id y household_id.
3. Disparo de Notificación por Consumo Excedido (Push Automatizado)
	Criterio 3.1 (Lógica Server-Side o Cloud Function):
	Cada vez que se cree un nuevo gasto (POST /api/v1/expenses), el backend calculará el consumo acumulado del mes del rubro modificado.
	Fórmula de Disparo:
"Gasto Acumulado Mes"≥"Tope Remote Config"×("alert_threshold_pct" /100)
	Si enable_push_alerts === true y la condición se cumple, se despachará un payload FCM a todos los dispositivos vinculados al hogar.
	Criterio 3.2 (Payload de Notificación Push FCM):
	Título: ⚠️ Tope Financiero en Riesgo
	Cuerpo: El rubro {Nombre_Categoria} ha consumido el {Porcentaje}% de su límite (${Monto_Consumido} de ${Monto_Tope}).
	Ejemplo Real: "⚠️ Tope Financiero en Riesgo: El rubro Restaurantes ha consumido el 82.5% de su límite (825.000de 1.000.000)."
	Icono: Logo de FinanzasHogar.
	Data Payload: { "click_action": "/por-categoria", "category_id": "restaurantes" } (Al pulsar la notificación, abre directamente la pestaña Por Categoría).
4. Notificación de Gasto Compartido Registrado
	Criterio 4.1: Si Benny registra un gasto categorizado como Compartido, el servidor enviará un Push a Charlie (y viceversa):
	Título: 💸 Nuevo Gasto Compartido
	Cuerpo: {Nombre_Usuario} ingresó un gasto de ${Monto} en {Categoria}.
Especificaciones Técnicas
JSON
// Ejemplo de Payload Enviado vía FCM Admin SDK
{
  "notification": {
    "title": "⚠️ Tope Financiero en Riesgo",
    "body": "El rubro Restaurantes ha consumido el 82.5% de su límite ($ 825.000 de $ 1.000.000).",
    "icon": "/assets/icons/icon-192x192.png"
  },
  "data": {
    "url": "/por-categoria",
    "category": "restaurantes"
  },
  "token": "fcm_target_device_token_here"
}
	Backend / Cloud Functions:
	Uso de firebase-admin (Node.js) para invocar messaging().send().
	Middleware para consultar periódicamente o por evento de base de datos (onCreate / onUpdate de gasto) los parámetros vigentes de Remote Config mediante el SDK de Administración.
