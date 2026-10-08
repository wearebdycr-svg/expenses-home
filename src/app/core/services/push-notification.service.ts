import { Injectable, inject, signal } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed,
} from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { environment } from '../../../environments/environment';
import type { Expense, ExpenseDraft, ExpensePerson } from '../../features/gastos/data/expense.model';
import type { TcExpense, TcExpenseDraft } from '../../features/tc-compartida/data/tc.model';
import type { IncomeDraft } from '../../features/ingresos/data/income.model';
import type { DebtDraft } from '../../features/deudas/data/debt.model';
import { formatCOP } from '../../features/categoria/data/categoria.model';
import { RemoteConfigService } from './remote-config.service';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';

export const FCM_TOKEN_STORAGE_KEY = 'fcm_device_token';
export const FCM_PERSON_STORAGE_KEY = 'fcm_registered_person';

export function getWeekDateRange(refDate: Date = new Date()): { mondayStr: string; sundayStr: string } {
  const d = new Date(refDate);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const toStr = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  };

  return {
    mondayStr: toStr(monday),
    sundayStr: toStr(sunday),
  };
}

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

  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  private async init(): Promise<void> {
    if (typeof window === 'undefined') return;

    if (this.isNative()) {
      await this.initNative();
    } else {
      await this.initWeb();
    }
  }

  private async initNative(): Promise<void> {
    this.isSupported.set(true);

    const savedToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    if (savedToken) {
      this.currentToken.set(savedToken);
      this.isSubscribed.set(true);
      // Re-asegurar registro en Supabase/Backend por si la app estuvo offline o hubo fallo de RLS previo
      this.registerTokenInBackend(savedToken, 'Hogar (Móvil)').catch(() => {});
    }

    try {
      // 1. Crear canal de notificaciones Android con alta prioridad
      await PushNotifications.createChannel({
        id: 'finanzas_hogar_alerts',
        name: 'Alertas Finanzas Hogar',
        description: 'Notificaciones en tiempo real del hogar',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: 'finanzas_hogar_alerts',
        name: 'Alertas Finanzas Hogar',
        description: 'Notificaciones en tiempo real del hogar',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
      });

      // 2. Comprobar permisos actuales y solicitarlos automáticamente si aún no se han concedido
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
        permStatus = await PushNotifications.requestPermissions();
        try {
          await LocalNotifications.requestPermissions();
        } catch {
          // ignore local notification permission errors
        }
      }
      if (permStatus.receive === 'granted') {
        this.permission.set('granted');
        await PushNotifications.register();
      } else {
        this.permission.set(permStatus.receive === 'denied' ? 'denied' : 'default');
      }

      // 3. Listener para token recibido
      await PushNotifications.addListener('registration', async (token: Token) => {
        console.log('[Native Push] Token FCM recibido:', token.value);
        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token.value);
        this.currentToken.set(token.value);
        this.isSubscribed.set(true);
        await this.registerTokenInBackend(token.value, 'Hogar (Móvil)');
      });

      // 4. Listener para errores de registro
      await PushNotifications.addListener('registrationError', (error: any) => {
        console.warn('[Native Push] Error de registro FCM:', error);
      });

      // 5. Listener para notificación recibida con la app en primer plano
      await PushNotifications.addListener(
        'pushNotificationReceived',
        async (notification: PushNotificationSchema) => {
          console.log('[Native Push] Notificación en primer plano recibida:', notification);
          const title = notification.title || 'Finanzas Hogar';
          const body = notification.body || '';
          this.toastService.info(`${title}: ${body}`);
          await this.showSystemNotification(title, body, notification.data?.url || '/#gastos');
        }
      );

      // 6. Listener para notificación pulsada
      await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action: ActionPerformed) => {
          console.log('[Native Push] Notificación pulsada:', action);
          const url = action.notification.data?.url || '/#gastos';
          if (url && typeof window !== 'undefined') {
            const hash = url.startsWith('/') ? url : `/${url}`;
            window.location.hash = hash.replace(/^\/#?/, '');
          }
        }
      );
    } catch (e) {
      console.warn('[Native Push] Inicialización de notificaciones nativas omitida:', e);
    }
  }

  private async initWeb(): Promise<void> {
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
        // Re-asegurar registro en Supabase/Backend
        this.registerTokenInBackend(savedToken, 'Hogar (Web)').catch(() => {});
      }
    }

    try {
      const firebaseConfig = environment.firebase;
      let swUrl = '/firebase-messaging-sw.js';
      if (firebaseConfig?.apiKey && firebaseConfig?.projectId) {
        const queryParams = new URLSearchParams({
          apiKey: firebaseConfig.apiKey,
          authDomain: firebaseConfig.authDomain || '',
          projectId: firebaseConfig.projectId,
          storageBucket: firebaseConfig.storageBucket || '',
          messagingSenderId: firebaseConfig.messagingSenderId || '',
          appId: firebaseConfig.appId || '',
          measurementId: firebaseConfig.measurementId || '',
        }).toString();
        swUrl = `/firebase-messaging-sw.js?${queryParams}`;
      }
      // Registrar el Service Worker estándar de FCM con configuración dinámica
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
          console.log('[PushNotificationService] Notificación en primer plano recibida:', payload);
          const title = payload.notification?.title || payload.data?.['title'] || 'FinanzasHogar';
          const body = payload.notification?.body || payload.data?.['body'] || '';

          // Disparar banner del sistema operativo (macOS, Windows, Android)
          this.showSystemNotification(title, body, payload.data?.['url'] || '/#gastos');

          this.toastService.info(`${title}: ${body}`);
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
    if (this.isNative()) {
      return this.requestNativeSubscription();
    }
    return this.requestWebSubscription();
  }

  async requestNativeSubscription(): Promise<string | null> {
    try {
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive !== 'granted') {
        permStatus = await PushNotifications.requestPermissions();
      }

      try {
        await LocalNotifications.requestPermissions();
      } catch {
        // Ignorar
      }

      if (permStatus.receive === 'granted') {
        this.permission.set('granted');
        await PushNotifications.register();
        this.toastService.success('Notificaciones push activadas en este dispositivo');
        return this.currentToken();
      } else {
        this.permission.set('denied');
        this.toastService.warning('Permisos de notificación no otorgados en el móvil.');
        return null;
      }
    } catch (err: any) {
      console.error('[Native Push] Error solicitando permisos nativos:', err);
      this.toastService.error('Error al activar notificaciones en la app');
      return null;
    }
  }

  private async requestWebSubscription(): Promise<string | null> {
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
   * Resuelve la URL absoluta del endpoint cuando corre nativo en Capacitor móvil
   */
  getApiUrl(endpoint: string): string {
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (this.isNative()) {
      const base = (environment as any).apiUrl || 'https://finanzas-hogar-control-familiar.vercel.app';
      return `${base.replace(/\/$/, '')}${cleanPath}`;
    }
    return cleanPath;
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

    // Llamado complementario a la API serverless con URL absoluta si corre en móvil
    try {
      const url = this.getApiUrl('/api/fcm-token');
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          person,
          household_id: 'family-home',
          device_info: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      });
    } catch (err) {
      console.warn('[PushNotificationService] Error registrando token en backend API:', err);
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
    await this.checkBudgetThresholdAlert(newExpense, monthlyExpenses);
  }

  /**
   * Evalúa si un gasto supera el presupuesto mensual configurado en Remote Config
   */
  async checkBudgetThresholdAlert(newExpense: ExpenseDraft, monthlyExpenses: readonly Expense[]): Promise<void> {
    const isPushEnabled = this.remoteConfig.enablePushAlerts();
    if (!isPushEnabled) return;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const budget = this.remoteConfig.getBudgetForCategory(newExpense.category);
    if (budget != null && budget > 0) {
      const sameCategoryExpenses = monthlyExpenses.filter((e) => {
        const [y, m] = e.date.split('-').map(Number);
        return y === currentYear && m === currentMonth && e.category === newExpense.category;
      });

      const accumulated = sameCategoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const thresholdPct = this.remoteConfig.alertThresholdPct();
      const thresholdAmount = budget * (thresholdPct / 100);

      if (accumulated >= thresholdAmount) {
        const pct = (accumulated / budget) * 100;
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
   * Dispara notificación al crear consumo de TC y evalúa el tope semanal de $100.000 COP (o configurado en Remote Config)
   */
  async handleTcExpenseCreated(newExpense: TcExpenseDraft, allTcExpenses: readonly TcExpense[]): Promise<void> {
    const isPushEnabled = this.remoteConfig.enablePushAlerts();
    if (!isPushEnabled) {
      return;
    }

    const creator = newExpense.person || 'Alguien';
    const desc = newExpense.description || newExpense.category || 'Consumo';
    const tcMessage: PushNotificationMessage = {
      title: `💳 ${creator} usó la TC Compartida`,
      body: `${formatCOP(newExpense.amount)} - ${desc}`,
      icon: '/favicon.svg',
      data: {
        url: '/#tc-compartida',
        type: 'tc_expense',
      },
      targetPerson: 'all',
    };

    await this.dispatchPushNotification(tcMessage);
    await this.checkTcWeeklyBudgetAlert(newExpense, allTcExpenses);
  }

  /**
   * Evalúa el tope semanal de la tarjeta compartida según Remote Config
   */
  async checkTcWeeklyBudgetAlert(newExpense: TcExpenseDraft, allTcExpenses: readonly TcExpense[]): Promise<void> {
    const isPushEnabled = this.remoteConfig.enablePushAlerts();
    if (!isPushEnabled) return;

    const tcWeeklyBudget = this.remoteConfig.tcWeeklyBudget();
    if (tcWeeklyBudget > 0) {
      const { mondayStr, sundayStr } = getWeekDateRange();
      const currentWeekExpenses = allTcExpenses.filter(
        (e) => e.date >= mondayStr && e.date <= sundayStr
      );
      const weeklyAccumulated = currentWeekExpenses.reduce((sum, e) => sum + e.amount, 0) + newExpense.amount;

      if (weeklyAccumulated >= tcWeeklyBudget) {
        const alertMessage: PushNotificationMessage = {
          title: '🚨 Tope Semanal TC Compartida Superado',
          body: `Los consumos con la TC esta semana suman ${formatCOP(weeklyAccumulated)}, superando el límite semanal de ${formatCOP(tcWeeklyBudget)}.`,
          icon: '/favicon.svg',
          data: {
            url: '/#tc-compartida',
            type: 'tc_weekly_budget_exceeded',
          },
          targetPerson: 'all',
        };
        await this.dispatchPushNotification(alertMessage);
      } else {
        const thresholdPct = this.remoteConfig.alertThresholdPct();
        const thresholdAmount = tcWeeklyBudget * (thresholdPct / 100);
        if (weeklyAccumulated >= thresholdAmount) {
          const pct = (weeklyAccumulated / tcWeeklyBudget) * 100;
          const warningMessage: PushNotificationMessage = {
            title: '⚠️ Tope Semanal TC en Riesgo',
            body: `Los consumos de TC esta semana han consumido el ${pct.toFixed(0)}% del límite (${formatCOP(weeklyAccumulated)} de ${formatCOP(tcWeeklyBudget)}).`,
            icon: '/favicon.svg',
            data: {
              url: '/#tc-compartida',
              type: 'tc_weekly_budget_warning',
            },
            targetPerson: 'all',
          };
          await this.dispatchPushNotification(warningMessage);
        }
      }
    }
  }

  /**
   * Dispara notificación cuando se registra un nuevo ingreso
   */
  async handleIncomeCreated(newIncome: IncomeDraft): Promise<void> {
    const isPushEnabled = this.remoteConfig.enablePushAlerts();
    if (!isPushEnabled) {
      return;
    }

    const person = newIncome.person || 'Alguien';
    const descText = newIncome.description ? ` (${newIncome.description})` : '';
    const incomeMessage: PushNotificationMessage = {
      title: `💰 ${person} registró un ingreso`,
      body: `${formatCOP(newIncome.amount)} en ${newIncome.source}${descText}`,
      icon: '/favicon.svg',
      data: {
        url: '/#ingresos',
        type: 'income',
      },
      targetPerson: 'all',
    };

    await this.dispatchPushNotification(incomeMessage);
  }

  /**
   * Dispara notificación cuando se crea una nueva deuda
   */
  async handleDebtCreated(newDebt: DebtDraft): Promise<void> {
    const isPushEnabled = this.remoteConfig.enablePushAlerts();
    if (!isPushEnabled) {
      return;
    }

    const person = newDebt.person || 'Compartido';
    const debtMessage: PushNotificationMessage = {
      title: `📋 Nueva deuda registrada: ${newDebt.name}`,
      body: `${formatCOP(newDebt.originalAmount)} (${person}) - Cuota: ${formatCOP(newDebt.monthlyPayment)}`,
      icon: '/favicon.svg',
      data: {
        url: '/#deudas',
        type: 'debt',
      },
      targetPerson: 'all',
    };

    await this.dispatchPushNotification(debtMessage);
  }

  /**
   * Despacha la notificación Push vía backend serverless para los demás dispositivos del hogar
   */
  async dispatchPushNotification(message: PushNotificationMessage): Promise<void> {
    const senderToken = this.currentToken();
    try {
      const url = this.getApiUrl('/api/notify');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      // Adjuntar token de autenticación para protección de función crítica
      const { data: sessionData } = await this.supabase.client.auth.getSession();
      const authToken = sessionData?.session?.access_token || environment.supabaseAnonKey;
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...message,
          senderToken,
        }),
      });
    } catch (err) {
      console.warn('[PushNotificationService] Fallo al despachar push a backend API:', err);
    }
  }

  /**
   * Dispara una notificación Push a los demás dispositivos cuando se elimina un gasto
   */
  async handleExpenseDeleted(deletedExpense: { person?: string; amount: number; category: string; description?: string }): Promise<void> {
    const isPushEnabled = this.remoteConfig.enablePushAlerts();
    if (!isPushEnabled) return;

    const person = deletedExpense.person || 'Alguien';
    const title = person === 'Compartido' ? '🗑️ Gasto Compartido Eliminado' : `🗑️ ${person} eliminó un gasto`;
    const descText = deletedExpense.description ? ` (${deletedExpense.description})` : '';
    const message: PushNotificationMessage = {
      title,
      body: `${formatCOP(deletedExpense.amount)} en ${deletedExpense.category}${descText}`,
      icon: '/favicon.svg',
      data: {
        url: '/#gastos',
        category: deletedExpense.category,
        action: 'deleted',
      },
      targetPerson: 'all',
    };

    await this.dispatchPushNotification(message);
  }

  /**
   * Dispara una notificación Push a los demás dispositivos cuando se elimina un consumo de TC
   */
  async handleTcExpenseDeleted(deletedExpense: { person?: string; amount: number; description?: string; category?: string }): Promise<void> {
    const isPushEnabled = this.remoteConfig.enablePushAlerts();
    if (!isPushEnabled) return;

    const person = deletedExpense.person || 'Alguien';
    const title = `🗑️ Consumo TC Eliminado (${person})`;
    const desc = deletedExpense.description || deletedExpense.category || 'Consumo';
    const message: PushNotificationMessage = {
      title,
      body: `${formatCOP(deletedExpense.amount)} - ${desc}`,
      icon: '/favicon.svg',
      data: {
        url: '/#tc-compartida',
        type: 'tc_expense_deleted',
      },
      targetPerson: 'all',
    };

    await this.dispatchPushNotification(message);
  }

  /**
   * Dispara una notificación Push a los demás dispositivos cuando se elimina una deuda
   */
  async handleDebtDeleted(deletedDebt: { name?: string; person?: string; originalAmount?: number; original_amount?: number }): Promise<void> {
    const isPushEnabled = this.remoteConfig.enablePushAlerts();
    if (!isPushEnabled) return;

    const amount = Number(deletedDebt.originalAmount ?? deletedDebt.original_amount ?? 0);
    const amountText = amount > 0 ? ` (${formatCOP(amount)})` : '';
    const message: PushNotificationMessage = {
      title: `🗑️ Deuda Eliminada: ${deletedDebt.name || 'Deuda'}`,
      body: `Se ha retirado del control financiero${amountText} - ${deletedDebt.person || 'Compartido'}`,
      icon: '/favicon.svg',
      data: {
        url: '/#deudas',
        type: 'debt_deleted',
      },
      targetPerson: 'all',
    };

    await this.dispatchPushNotification(message);
  }

  /**
   * Dispara una notificación Push a los demás dispositivos cuando se elimina un ingreso
   */
  async handleIncomeDeleted(deletedIncome: { person?: string; amount: number; source?: string; description?: string }): Promise<void> {
    const isPushEnabled = this.remoteConfig.enablePushAlerts();
    if (!isPushEnabled) return;

    const person = deletedIncome.person || 'Alguien';
    const descText = deletedIncome.description ? ` (${deletedIncome.description})` : '';
    const message: PushNotificationMessage = {
      title: `🗑️ Ingreso Eliminado (${person})`,
      body: `${formatCOP(deletedIncome.amount)} de ${deletedIncome.source || 'Ingreso'}${descText}`,
      icon: '/favicon.svg',
      data: {
        url: '/#ingresos',
        type: 'income_deleted',
      },
      targetPerson: 'all',
    };

    await this.dispatchPushNotification(message);
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
   * Dispara una alerta cuando se elimina un gasto desde otro dispositivo
   */
  notifyIncomingExpenseDeleted(expense: { person?: string; amount?: number; category?: string; description?: string }): void {
    const person = expense.person || 'Alguien';
    const title = person === 'Compartido' ? '🗑️ Gasto Compartido Eliminado' : `🗑️ ${person} eliminó un gasto`;
    const descText = expense.description ? ` (${expense.description})` : '';
    const amountText = expense.amount != null ? `${formatCOP(expense.amount)} en ` : '';
    const body = `${amountText}${expense.category || 'Gasto'}${descText}`;

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
   * Dispara una alerta cuando se elimina un consumo de TC desde otro dispositivo
   */
  notifyIncomingTcExpenseDeleted(expense: { person?: string; amount?: number; description?: string; category?: string }): void {
    const person = expense.person || 'Alguien';
    const title = `🗑️ Consumo TC Eliminado (${person})`;
    const desc = expense.description || expense.category || 'Consumo';
    const amountText = expense.amount != null ? `${formatCOP(expense.amount)} - ` : '';
    const body = `${amountText}${desc}`;

    this.showSystemNotification(title, body, '/#tc-compartida');
  }

  /**
   * Dispara una alerta cuando otro dispositivo registra un ingreso
   */
  notifyIncomingIncome(income: { person?: string; amount: number; source?: string; description?: string }): void {
    const person = income.person || 'Alguien';
    const descText = income.description ? ` (${income.description})` : '';
    const title = `💰 ${person} registró un ingreso`;
    const body = `${formatCOP(income.amount)} en ${income.source || 'Ingreso'}${descText}`;

    this.showSystemNotification(title, body, '/#ingresos');
  }

  /**
   * Dispara una alerta cuando se elimina un ingreso desde otro dispositivo
   */
  notifyIncomingIncomeDeleted(income: { person?: string; amount?: number; source?: string }): void {
    const person = income.person || 'Alguien';
    const title = `🗑️ Ingreso Eliminado (${person})`;
    const amountText = income.amount != null ? `${formatCOP(income.amount)} de ` : '';
    const body = `${amountText}${income.source || 'Ingreso'}`;

    this.showSystemNotification(title, body, '/#ingresos');
  }

  /**
   * Dispara una alerta cuando otro dispositivo registra una nueva deuda
   */
  notifyIncomingDebt(debt: { name?: string; original_amount?: number; originalAmount?: number; person?: string; monthly_payment?: number; monthlyPayment?: number }): void {
    const title = `📋 Nueva deuda registrada: ${debt.name || 'Deuda'}`;
    const amount = Number(debt.original_amount ?? debt.originalAmount ?? 0);
    const quota = Number(debt.monthly_payment ?? debt.monthlyPayment ?? 0);
    const body = `${formatCOP(amount)} (${debt.person || 'Compartido'})${quota > 0 ? ` - Cuota: ${formatCOP(quota)}` : ''}`;

    this.showSystemNotification(title, body, '/#deudas');
  }

  /**
   * Dispara una alerta cuando se elimina una deuda desde otro dispositivo
   */
  notifyIncomingDebtDeleted(debt: { name?: string; person?: string }): void {
    const title = `🗑️ Deuda Eliminada: ${debt.name || 'Deuda'}`;
    const body = `Se eliminó del registro (${debt.person || 'Compartido'})`;

    this.showSystemNotification(title, body, '/#deudas');
  }

  async scheduleNativeNotification(title: string, body: string, url: string = '/#gastos'): Promise<void> {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 1000000),
          title,
          body,
          channelId: 'finanzas_hogar_alerts',
          extra: { url },
          smallIcon: 'ic_launcher_round',
          iconColor: '#F97316',
        },
      ],
    });
  }

  /**
   * Muestra la notificación nativa usando LocalNotifications (en móvil) o Service Worker (en web)
   */
  async showSystemNotification(title: string, body: string, url: string = '/#gastos'): Promise<void> {
    if (this.isNative()) {
      try {
        await this.scheduleNativeNotification(title, body, url);
        return;
      } catch (e) {
        console.warn('[Native LocalNotification] Fallo al mostrar:', e);
        this.toastService.info(`${title}: ${body}`);
        return;
      }
    }

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
    if (this.isNative()) {
      if (this.permission() !== 'granted') {
        const res = await this.requestSubscription();
        if (!res && this.permission() !== 'granted') return;
      }
      await this.showSystemNotification(
        '🔔 Notificación de Prueba',
        '¡Tu teléfono está listo y recibiendo alertas en tiempo real!',
        '/#gastos'
      );
      this.toastService.success('Notificación de prueba enviada a tu teléfono');
      return;
    }

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

