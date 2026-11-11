import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../../environments/environment';
import { SupabaseService } from '../../services/supabase.service';
import {
  NotificationPayload,
  NotificationProvider,
  NotificationResult,
} from '../notification-provider.interface';

interface BackendNotifyResponse {
  readonly success?: boolean;
  readonly messageId?: string;
  readonly fcmSent?: number;
  readonly error?: string;
}

/**
 * Adaptador de infraestructura para notificaciones push mediante FCM / Serverless.
 */
@Injectable({
  providedIn: 'root',
})
export class FcmNotificationAdapter implements NotificationProvider {
  readonly providerName = 'fcm';

  private readonly http = inject(HttpClient);
  private readonly supabase = inject(SupabaseService);
  private readonly endpointPath = '/api/notify';

  getEndpointUrl(): string {
    if (Capacitor.isNativePlatform() && environment.apiUrl) {
      return `${environment.apiUrl.replace(/\/$/, '')}${this.endpointPath}`;
    }
    return this.endpointPath;
  }

  isSupported(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    if (Capacitor.isNativePlatform()) {
      return true;
    }
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  async sendNotification(
    recipientId: string,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    try {
      const url = this.getEndpointUrl();
      const { data: sessionData } = await this.supabase.client.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        return {
          success: false,
          error: 'Sesión de Supabase no autenticada para enviar notificaciones',
          timestamp: new Date().toISOString(),
        };
      }

      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      });

      const body = {
        recipientId,
        title: payload.title,
        body: payload.body,
        tag: payload.tag,
        data: {
          ...(payload.data ?? {}),
          tag: payload.tag,
          priority: payload.priority ?? 'normal',
        },
      };

      const response = await firstValueFrom(
        this.http.post<BackendNotifyResponse>(url, body, { headers })
      );

      if (response && response.success === false) {
        return {
          success: false,
          error: response.error ?? 'Error devuelto por el servidor de notificaciones',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        messageId: response?.messageId,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof HttpErrorResponse
          ? (typeof error.error === 'object' && error.error !== null && 'error' in error.error
              ? String((error.error as { error: unknown }).error)
              : error.message || `HTTP ${error.status}`)
          : error instanceof Error
            ? error.message
            : 'Error desconocido al enviar notificación push';

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
