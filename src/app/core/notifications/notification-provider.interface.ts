import { InjectionToken } from '@angular/core';

/**
 * Payload inmutable para el envío de notificaciones push desacopladas.
 */
export interface NotificationPayload {
  readonly title: string;
  readonly body: string;
  /**
   * Identificador para agrupar o reemplazar notificaciones del mismo gasto/entidad.
   */
  readonly tag: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly priority?: 'high' | 'normal';
}

/**
 * Resultado estructurado e inmutable de la operación de notificación.
 */
export interface NotificationResult {
  readonly success: boolean;
  readonly messageId?: string;
  readonly error?: string;
  /**
   * Marca temporal en formato canónico ISO 8601 (ej. 'YYYY-MM-DDTHH:mm:ss.sssZ').
   */
  readonly timestamp: string;
}

/**
 * Puerto abstracto (Hexagonal / Clean Architecture) para proveedores de notificación push.
 * Aísla completamente la capa de dominio de SDKs de terceros (FCM, Web Push, Capacitor).
 */
export interface NotificationProvider {
  readonly providerName: string;

  /**
   * Envía una notificación push al destinatario indicado.
   *
   * @param recipientId Identificador único del destinatario (token FCM, endpoint Web Push o userId).
   * @param payload Contenido inmutable de la notificación.
   */
  sendNotification(
    recipientId: string,
    payload: NotificationPayload
  ): Promise<NotificationResult>;

  /**
   * Verifica la disponibilidad o soporte del canal de notificación en el entorno actual.
   */
  isSupported(): Promise<boolean> | boolean;
}

/**
 * Token de inyección de Angular para desacoplar el puerto de sus adaptadores concretos.
 */
export const NOTIFICATION_PROVIDER = new InjectionToken<NotificationProvider>(
  'NOTIFICATION_PROVIDER'
);
