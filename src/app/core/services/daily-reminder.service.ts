import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ExpensesService } from '../../features/gastos/data/expenses.service';
import { RemoteConfigService } from './remote-config.service';
import { ToastService } from './toast.service';

export const REMINDER_STORAGE_KEY = 'last_daily_reminder_dismissed';
export const DEFAULT_REMINDER_HOUR = 20; // 8:00 PM (Criterio 2.1)

export function getLocalDateIso(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Injectable({
  providedIn: 'root',
})
export class DailyReminderService {
  private readonly expensesService = inject(ExpensesService);
  private readonly remoteConfig = inject(RemoteConfigService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly reminderHour = computed(() => this.remoteConfig.dailyReminderHour());
  readonly reminderMessage = computed(() => this.remoteConfig.dailyReminderMessage());
  readonly showBanner = signal<boolean>(false);

  private intervalId: any = null;

  constructor() {
    this.init();
  }

  private init(): void {
    if (typeof window === 'undefined') return;

    // 1. Evaluación inmediata al instanciar
    this.evaluateReminder();

    // 2. Evaluación periódica cada 60 segundos
    this.intervalId = setInterval(() => {
      this.evaluateReminder();
    }, 60_000);

    // 3. Evaluación al enfocar la pestaña (window.onfocus / visibilitychange)
    const onFocus = () => this.evaluateReminder();
    window.addEventListener('focus', onFocus);
    window.addEventListener('visibilitychange', onFocus);

    this.destroyRef.onDestroy(() => {
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('visibilitychange', onFocus);
    });
  }

  shouldShowReminder(now: Date = new Date()): boolean {
    if (typeof window === 'undefined') return false;

    // Criterio 2.1: Verificar si ya alcanzamos o superamos la hora límite (>= 20:00 hrs)
    if (now.getHours() < this.reminderHour()) {
      return false;
    }

    const todayStr = getLocalDateIso(now);

    // Criterio 2.4: Verificar si ya fue descartado en la jornada de hoy
    try {
      const dismissedDay = localStorage.getItem(REMINDER_STORAGE_KEY);
      if (dismissedDay === todayStr) {
        return false;
      }
    } catch {
      // Ignorar error de localStorage
    }

    // Criterio 2.1: Evaluar si existen gastos en la fecha actual
    const allExpenses = this.expensesService.allExpenses();
    const hasExpensesToday = allExpenses.some((exp) => exp.date === todayStr);

    return !hasExpensesToday;
  }

  evaluateReminder(now: Date = new Date()): void {
    const shouldShow = this.shouldShowReminder(now);
    this.showBanner.set(shouldShow);

    // Criterio 2.3: Notificación nativa del SO/navegador si los permisos están concedidos
    if (shouldShow && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        const todayStr = getLocalDateIso(now);
        const alreadyNotified = sessionStorage.getItem('last_native_reminder_sent');
        if (alreadyNotified !== todayStr) {
          try {
            new Notification('FinanzasHogar', {
              body: `🌙 Recordatorio diario: ${this.reminderMessage()}`,
              icon: '/favicon.ico',
            });
            sessionStorage.setItem('last_native_reminder_sent', todayStr);
          } catch {
            // Ignorar error de notificación
          }
        }
      }
    }
  }

  dismissForToday(): void {
    const todayStr = getLocalDateIso();
    try {
      localStorage.setItem(REMINDER_STORAGE_KEY, todayStr);
    } catch {}
    this.showBanner.set(false);
    this.toastService.info('Entendido: Registrado que hoy no tuviste gastos.');
  }

  async requestNotificationPermission(): Promise<NotificationPermission | null> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
    return null;
  }
}
