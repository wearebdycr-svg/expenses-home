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
    if (savedToken) {
      if (savedToken.startsWith('fcm-dev-')) {
        localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
        this.currentToken.set(null);
        this.isSubscribed.set(false);
      } else {
        this.currentToken.set(savedToken);
        this.isSubscribed.set(true);
      }
    }

    try {
      // Registrar el Service Worker de FCM con los parámetros de configuración
      const firebaseConfig = environment.firebase;
      let swUrl = '/firebase-messaging-sw.js';
      if (firebaseConfig?.apiKey && firebaseConfig?.projectId) {
        const params = new URLSearchParams({
          apiKey: firebaseConfig.apiKey,
          projectId: firebaseConfig.projectId,
          messagingSenderId: firebaseConfig.messagingSenderId || '',
          appId: firebaseConfig.appId || '',
        });
        swUrl = `/firebase-messaging-sw.js?${params.toString()}`;
      }

      this.swRegistration = await navigator.serviceWorker.register(swUrl);
      console.log('[PushNotificationService] Service Worker registrado:', this.swRegistration.scope);

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
   * Criterio 2.1 & 2.2: Solicita permiso y registra el Token FCM del dispositivo en el backend
   */
  async requestSubscription(): Promise<string | null> {
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

      // 1. Obtener token oficial de FCM desde Google
      if (this.messagingInstance) {
        try {
          const swReg = this.swRegistration || (await navigator.serviceWorker.ready);
          const vapidKey = (environment.firebase as any)?.vapidKey;
          console.log('[PushNotificationService] Solicitando token FCM oficial a Google...');
          token = await getToken(this.messagingInstance, {
            serviceWorkerRegistration: swReg,
            ...(vapidKey ? { vapidKey } : {}),
          });
          console.log('[PushNotificationService] Token oficial de FCM obtenido con éxito:', token);
        } catch (e: any) {
          console.error('[PushNotificationService] Error al obtener getToken de Firebase:', e);
          this.toastService.error(`Error Firebase: ${e?.message || e}`);
          return null;
        }
      }

      if (!token) {
        this.toastService.error('No se pudo obtener el token oficial de Firebase.');
        return null;
      }

      // 2. Guardar en localStorage
      localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);

      this.currentToken.set(token);
      this.isSubscribed.set(true);

      // 3. Criterio 2.2: Registrar token en Supabase / Backend API
      await this.registerTokenInBackend(token, 'Hogar');

      this.toastService.success('Notificaciones del hogar activadas en este equipo');
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

    // 1. Notificación a los demás dispositivos para cualquier gasto registrado (Charlie, Benny o Compartido)
    const creator = newExpense.person || 'Alguien';
    const descText = newExpense.description ? ` (${newExpense.description})` : '';
    const expenseMessage: PushNotificationMessage = {
      title: creator === 'Compartido' ? '💸 Nuevo Gasto Compartido' : `💸 ${creator} registró un gasto`,
      body: `${formatCOP(newExpense.amount)} en ${newExpense.category}${descText}`,
      icon: '/favicon.svg',
      data: {
        url: '/#gastos',
        category: newExpense.category,
      },
      targetPerson: 'all',
    };

    await this.dispatchPushNotification(expenseMessage);

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
   * Despacha la notificación Push vía backend serverless para los demás dispositivos del hogar
   */
  async dispatchPushNotification(message: PushNotificationMessage): Promise<void> {
    const senderToken = this.currentToken();
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...message,
          senderToken,
        }),
      });
    } catch {
      // Fallback silencioso si no hay red o backend
    }
  }

  /**
   * Dispara una alerta nativa y toast cuando otro dispositivo registra un gasto
   */
  notifyIncomingExpense(expense: { person?: string; amount: number; category: string; description?: string }): void {
    const creator = expense.person || 'Alguien';
    const title = creator === 'Compartido' 
      ? '💸 Nuevo Gasto Compartido' 
      : `💸 ${creator} registró un gasto`;
    const descText = expense.description ? ` (${expense.description})` : '';
    const body = `${formatCOP(expense.amount)} en ${expense.category}${descText}`;

    this.showSystemNotification(title, body, '/#gastos');
  }

  /**
   * Dispara una alerta cuando se usa la Tarjeta Compartida desde otro dispositivo
   */
  notifyIncomingTcExpense(expense: { person?: string; amount: number; description?: string; category?: string }): void {
    const creator = expense.person || 'Alguien';
    const title = `💳 ${creator} usó la TC Compartida`;
    const desc = expense.description || expense.category || 'Consumo';
    const body = `${formatCOP(expense.amount)} - ${desc}`;

    this.showSystemNotification(title, body, '/#tc-compartida');
  }

  /**
   * Muestra la notificación nativa usando el Service Worker (móvil y escritorio) o fallback de Notification
   */
  async showSystemNotification(title: string, body: string, url: string = '/#gastos'): Promise<void> {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        let swReg = this.swRegistration;
        if (!swReg && 'serviceWorker' in navigator) {
          swReg = await navigator.serviceWorker.ready.catch(() => null);
        }

        if (swReg && typeof swReg.showNotification === 'function') {
          await swReg.showNotification(title, {
            body,
            icon: '/favicon.svg',
            badge: '/favicon.svg',
            data: { url },
          });
          return;
        }

        new Notification(title, {
          body,
          icon: '/favicon.svg',
          data: { url },
        });
      } catch (e) {
        console.warn('Fallo al mostrar notificación nativa:', e);
        this.toastService.info(`${title}: ${body}`);
      }
    } else {
      this.toastService.info(`${title}: ${body}`);
    }
  }

  /**
   * Envía una notificación de prueba para validar que este dispositivo recibe alertas
   */
  async sendTestNotification(): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      this.toastService.error('Este navegador no soporta notificaciones.');
      return;
    }

    if (Notification.permission !== 'granted') {
      const res = await this.requestSubscription();
      if (!res) return;
    }

    await this.showSystemNotification(
      '🔔 Notificación de Prueba',
      '¡Tu equipo está listo y recibiendo alertas en tiempo real!',
      '/#gastos'
    );
    this.toastService.success('Notificación de prueba enviada');
  }
}

