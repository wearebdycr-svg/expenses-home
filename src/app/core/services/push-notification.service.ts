import { Injectable, inject, signal } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { environment } from '../../../environments/environment';
import type { Expense, ExpenseDraft, ExpensePerson } from '../../features/gastos/data/expense.model';
import { formatCOP } from '../../features/categoria/data/categoria.model';
import { RemoteConfigService } from './remote-config.service';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';

export const FCM_TOKEN_STORAGE_KEY = 'fcm_device_token';
export const FCM_PERSON_STORAGE_KEY = 'fcm_registered_person';

export interface PushNotificationMessage {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, string>;
  targetPerson?: 'Benny' | 'Charlie' | 'all';
}

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  private readonly supabase = inject(SupabaseService);
  private readonly remoteConfig = inject(RemoteConfigService);
  private readonly toastService = inject(ToastService);

  private messagingInstance: Messaging | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;

  // Signals reactivos
  readonly isSupported = signal<boolean>(false);
  readonly permission = signal<NotificationPermission>('default');
  readonly isSubscribed = signal<boolean>(false);
  readonly currentToken = signal<string | null>(null);
  readonly registeredPerson = signal<string>('Hogar');

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (typeof window === 'undefined') return;

    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    this.isSupported.set(supported);

    if (!supported) return;

    this.permission.set(Notification.permission);

    // Recuperar suscripción previa de localStorage
    const savedToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    const savedPerson = localStorage.getItem(FCM_PERSON_STORAGE_KEY) || 'Hogar';
    if (savedToken) {
      this.currentToken.set(savedToken);
      this.isSubscribed.set(true);
      this.registeredPerson.set(savedPerson);
    }

    try {
      // Registrar el Service Worker de FCM
      this.swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('[PushNotificationService] Service Worker registrado:', this.swRegistration.scope);

      const firebaseConfig = environment.firebase;
      if (this.swRegistration.active && firebaseConfig?.apiKey) {
        this.swRegistration.active.postMessage({
          type: 'INIT_FIREBASE_MESSAGING',
          config: firebaseConfig,
        });
      }

      // Inicializar Firebase Messaging si hay configuración
      if (firebaseConfig?.apiKey && firebaseConfig?.projectId) {
        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        this.messagingInstance = getMessaging(app);

        // Escuchar notificaciones en primer plano
        onMessage(this.messagingInstance, (payload) => {
          console.log('[PushNotificationService] Notificación en primer plano:', payload);
          const title = payload.notification?.title || payload.data?.['title'] || 'FinanzasHogar';
          const body = payload.notification?.body || payload.data?.['body'] || '';

          this.toastService.warning(`${title}: ${body}`, {
            label: 'Ver',
            onClick: () => {
              if (window.location.hash !== '#categoria') {
                window.location.hash = 'categoria';
              }
            },
          });
        });
      }
    } catch (err) {
      console.warn('[PushNotificationService] No se pudo inicializar FCM en el cliente:', err);
    }
  }

  /**
   * Criterio 2.1 & 2.2: Solicita permiso y registra el Token FCM en el backend
   */
  async requestSubscription(person: string = 'Hogar'): Promise<string | null> {
    if (!this.isSupported()) {
      this.toastService.error('Las notificaciones Push no están soportadas en este navegador.');
      return null;
    }

    try {
      const permissionResult = await Notification.requestPermission();
      this.permission.set(permissionResult);

      if (permissionResult !== 'granted') {
        this.toastService.warning('Permisos de notificación no otorgados.');
        return null;
      }

      let token: string | null = null;

      // 1. Intentar obtener token oficial de FCM si hay messaging activo
      if (this.messagingInstance && this.swRegistration) {
        try {
          const vapidKey = (environment.firebase as any)?.vapidKey;
          token = await getToken(this.messagingInstance, {
            serviceWorkerRegistration: this.swRegistration,
            ...(vapidKey ? { vapidKey } : {}),
          });
        } catch (e) {
          console.warn('[PushNotificationService] getToken de Firebase falló, generando token de dispositivo:', e);
        }
      }

      // Si no hay token de FCM (modo dev / offline), generar identificador único de dispositivo
      if (!token) {
        token = `fcm-dev-${person.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      }

      // 2. Guardar en localStorage
      localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
      localStorage.setItem(FCM_PERSON_STORAGE_KEY, person);

      this.currentToken.set(token);
      this.isSubscribed.set(true);
      this.registeredPerson.set(person);

      // 3. Criterio 2.2: Registrar token en Supabase / Backend API
      await this.registerTokenInBackend(token, person);

      this.toastService.success('Notificaciones Push activadas en este dispositivo');
      return token;
    } catch (err: any) {
      console.error('[PushNotificationService] Error al suscribirse a notificaciones:', err);
      this.toastService.error('Error al registrar dispositivo para notificaciones push');
      return null;
    }
  }

  /**
   * Registra el token en la tabla fcm_tokens de Supabase y mediante el endpoint /api/fcm-token
   */
  async registerTokenInBackend(token: string, person: string = 'Hogar'): Promise<void> {
    try {
      await this.supabase.client.from('fcm_tokens').upsert(
        {
          token,
          person,
          household_id: 'family-home',
          device_info: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      );
    } catch (err) {
      console.warn('Error guardando token en Supabase:', err);
    }

    // Llamado complementario a la API serverless
    try {
      await fetch('/api/fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          person,
          household_id: 'family-home',
          device_info: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      });
    } catch {
      // Ignorar fallo de API si corre en modo local puro
    }
  }

  /**
   * Criterio 3.1 & 3.2 & 4.1:
   * Evalúa la creación de un nuevo gasto para disparar notificaciones Push automatizadas
   */
  async handleExpenseCreated(newExpense: ExpenseDraft, monthlyExpenses: readonly Expense[]): Promise<void> {
    const isPushEnabled = this.remoteConfig.enablePushAlerts();
    if (!isPushEnabled) {
      return;
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // 1. Criterio 4.1: Notificación de Gasto Compartido Registrado
    if (newExpense.person === 'Compartido') {
      const sharedMessage: PushNotificationMessage = {
        title: '💸 Nuevo Gasto Compartido',
        body: `Se registró un gasto de ${formatCOP(newExpense.amount)} en ${newExpense.category}.`,
        icon: '/favicon.svg',
        data: {
          url: '/#gastos',
          category: newExpense.category,
        },
        targetPerson: 'all',
      };

      await this.dispatchPushNotification(sharedMessage);
    }

    // 2. Criterio 3.1: Disparo de Notificación por Consumo Excedido (Push Automatizado)
    const budget = this.remoteConfig.getBudgetForCategory(newExpense.category);
    if (budget != null && budget > 0) {
      // Calcular gasto acumulado del mes para este rubro
      const sameCategoryExpenses = monthlyExpenses.filter((e) => {
        const [y, m] = e.date.split('-').map(Number);
        return y === currentYear && m === currentMonth && e.category === newExpense.category;
      });

      // Incluyendo el nuevo gasto
      const accumulated = sameCategoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);

      // Fórmula de disparo: Gasto Acumulado Mes >= Tope Remote Config * (alert_threshold_pct / 100)
      const thresholdPct = this.remoteConfig.alertThresholdPct();
      const thresholdAmount = budget * (thresholdPct / 100);

      if (accumulated >= thresholdAmount) {
        const pct = (accumulated / budget) * 100;
        // Criterio 3.2: Payload de Notificación Push FCM
        const alertMessage: PushNotificationMessage = {
          title: '⚠️ Tope Financiero en Riesgo',
          body: `El rubro ${newExpense.category} ha consumido el ${pct.toFixed(1)}% de su límite (${formatCOP(accumulated)} de ${formatCOP(budget)}).`,
          icon: '/favicon.svg',
          data: {
            click_action: '/#categoria',
            url: '/#categoria',
            category_id: newExpense.category.toLowerCase(),
          },
          targetPerson: 'all',
        };

        await this.dispatchPushNotification(alertMessage);
      }
    }
  }

  /**
   * Despacha la notificación Push vía backend serverless o notificación nativa local
   */
  async dispatchPushNotification(message: PushNotificationMessage): Promise<void> {
    try {
      // 1. Invocar endpoint del backend /api/notify
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    } catch {
      // Fallback si no hay backend activo
    }

    // 2. Si el usuario actual tiene permiso de notificación nativa concedido, mostrar alerta nativa
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(message.title, {
          body: message.body,
          icon: message.icon || '/favicon.svg',
          data: message.data,
        });
      } catch {
        // Fallback a toast
        this.toastService.warning(`${message.title}: ${message.body}`);
      }
    } else {
      this.toastService.warning(`${message.title}: ${message.body}`);
    }
  }
}
