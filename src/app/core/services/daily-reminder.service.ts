import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ExpensesService } from '../../features/gastos/data/expenses.service';
import { RemoteConfigService } from './remote-config.service';
import { ToastService } from './toast.service';

export const REMINDER_STORAGE_KEY = 'last_daily_reminder_dismissed';
export const DEFAULT_MORNING_REMINDER_HOUR = 19; // 7:00 PM
export const DEFAULT_EVENING_REMINDER_HOUR = 19; // 7:00 PM
export const DEFAULT_REMINDER_HOUR = 19; // 7:00 PM

export type ReminderSlot = 'morning' | 'evening' | null;

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

  readonly morningHour = computed(() => this.remoteConfig.dailyReminderMorningHour());
  readonly eveningHour = computed(() => this.remoteConfig.dailyReminderEveningHour());
  readonly reminderHour = computed(() => this.remoteConfig.dailyReminderHour());

  readonly currentSlot = signal<ReminderSlot>(null);

  readonly reminderMessage = computed(() => {
    return this.remoteConfig.dailyReminderEveningMessage();
  });

  readonly reminderIcon = computed(() => {
    return '📝';
  });

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

  getSlotForDate(now: Date = new Date()): ReminderSlot {
    const hour = now.getHours();
    // Único recordatorio al día: a partir de las 7:00 PM (19:00)
    if (hour >= this.eveningHour()) {
      return 'evening';
    }
    return null;
  }

  shouldShowReminder(now: Date = new Date()): boolean {
    if (typeof window === 'undefined') return false;

    // Solo se muestra en el turno de las 7:00 PM
    const slot = this.getSlotForDate(now);
    if (!slot) {
      return false;
    }

    const todayStr = getLocalDateIso(now);

    // Verificar si ya fue descartado hoy
    try {
      const dismissed = localStorage.getItem(REMINDER_STORAGE_KEY);
      if (dismissed === `${todayStr}_${slot}` || dismissed === todayStr) {
        return false;
      }
    } catch {
      // Ignorar error de localStorage
    }

    // Evaluar si existen gastos en la fecha actual
    const allExpenses = this.expensesService.allExpenses();
    const hasExpensesToday = allExpenses.some((exp) => exp.date === todayStr);

    return !hasExpensesToday;
  }

  evaluateReminder(now: Date = new Date()): void {
    const slot = this.getSlotForDate(now);
    this.currentSlot.set(slot);

    const shouldShow = this.shouldShowReminder(now);
    this.showBanner.set(shouldShow);

    // Notificación nativa del SO/navegador si los permisos están concedidos
    if (shouldShow && slot && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        const todayStr = getLocalDateIso(now);
        const slotKey = `${todayStr}_${slot}`;
        const alreadyNotified = localStorage.getItem('last_native_reminder_sent');
        if (alreadyNotified !== slotKey) {
          try {
            new Notification('FinanzasHogar', {
              body: `Recordatorio: ${this.reminderMessage()}`,
              icon: '/favicon.svg',
            });
            localStorage.setItem('last_native_reminder_sent', slotKey);
          } catch {
            // Ignorar error de notificación
          }
        }
      }
    }
  }

  dismissForToday(): void {
    const now = new Date();
    const todayStr = getLocalDateIso(now);
    const slot = this.getSlotForDate(now) || 'evening';
    try {
      localStorage.setItem(REMINDER_STORAGE_KEY, `${todayStr}_${slot}`);
      localStorage.setItem('last_native_reminder_sent', `${todayStr}_${slot}`);
    } catch {}
    this.showBanner.set(false);
    this.toastService.info('Entendido: Recordatorio pospuesto.');
  }

  async requestNotificationPermission(): Promise<NotificationPermission | null> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
    return null;
  }
}
