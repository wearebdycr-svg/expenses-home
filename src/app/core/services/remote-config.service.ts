import { Injectable, computed, signal } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getRemoteConfig,
  fetchAndActivate,
  getValue,
  RemoteConfig,
} from 'firebase/remote-config';
import { environment } from '../../../environments/environment';

export interface RemoteConfigValues {
  daily_reminder_morning_hour: number;
  daily_reminder_evening_hour: number;
  daily_reminder_hour?: number;
  daily_reminder_message: string;
  daily_reminder_morning_message: string;
  daily_reminder_evening_message: string;
  tc_weekly_budget: number;
  budget_hogar: number;
  budget_alimentacion: number;
  budget_restaurantes: number;
  budget_transporte: number;
  budget_entretenimiento: number;
  alert_threshold_pct: number;
  enable_push_alerts: boolean;
}

export const DEFAULT_REMOTE_CONFIG: RemoteConfigValues = {
  daily_reminder_hour: 21,
  daily_reminder_morning_hour: 9,
  daily_reminder_evening_hour: 21,
  daily_reminder_message: '¿Tuviste gastos hoy? No olvides reportar los gastos de hoy',
  daily_reminder_morning_message: '☀️ ¡Buenos días! No olvides reportar los gastos que tengas hoy o pendientes de ayer',
  daily_reminder_evening_message: '🌙 ¡Buenas noches! Recuerda registrar todos tus gastos de hoy para mantener las cuentas al día',
  tc_weekly_budget: 100_000,
  budget_hogar: 2_500_000,
  budget_alimentacion: 2_000_000,
  budget_restaurantes: 1_000_000,
  budget_transporte: 800_000,
  budget_entretenimiento: 500_000,
  alert_threshold_pct: 80,
  enable_push_alerts: true,
};

@Injectable({
  providedIn: 'root',
})
export class RemoteConfigService {
  private remoteConfigInstance: RemoteConfig | null = null;

  // Signals reactivos para el estado global (Criterio 1.1 y 2.1)
  readonly isLoaded = signal<boolean>(false);
  readonly dailyReminderHour = signal<number>(DEFAULT_REMOTE_CONFIG.daily_reminder_hour ?? DEFAULT_REMOTE_CONFIG.daily_reminder_evening_hour);
  readonly dailyReminderMorningHour = signal<number>(DEFAULT_REMOTE_CONFIG.daily_reminder_morning_hour);
  readonly dailyReminderEveningHour = signal<number>(DEFAULT_REMOTE_CONFIG.daily_reminder_evening_hour);
  readonly dailyReminderMessage = signal<string>(DEFAULT_REMOTE_CONFIG.daily_reminder_message);
  readonly dailyReminderMorningMessage = signal<string>(DEFAULT_REMOTE_CONFIG.daily_reminder_morning_message);
  readonly dailyReminderEveningMessage = signal<string>(DEFAULT_REMOTE_CONFIG.daily_reminder_evening_message);
  readonly tcWeeklyBudget = signal<number>(DEFAULT_REMOTE_CONFIG.tc_weekly_budget);
  readonly budgetHogar = signal<number>(DEFAULT_REMOTE_CONFIG.budget_hogar);
  readonly budgetAlimentacion = signal<number>(DEFAULT_REMOTE_CONFIG.budget_alimentacion);
  readonly budgetRestaurantes = signal<number>(DEFAULT_REMOTE_CONFIG.budget_restaurantes);
  readonly budgetTransporte = signal<number>(DEFAULT_REMOTE_CONFIG.budget_transporte);
  readonly budgetEntretenimiento = signal<number>(DEFAULT_REMOTE_CONFIG.budget_entretenimiento);
  readonly alertThresholdPct = signal<number>(DEFAULT_REMOTE_CONFIG.alert_threshold_pct);
  readonly enablePushAlerts = signal<boolean>(DEFAULT_REMOTE_CONFIG.enable_push_alerts);

  /**
   * Mapa de presupuestos por categoría normalizada para consulta inmediata en UI
   */
  readonly budgetsByCategory = computed<Record<string, number>>(() => ({
    Hogar: this.budgetHogar(),
    Mercado: this.budgetAlimentacion(),
    Alimentación: this.budgetAlimentacion(),
    Transporte: this.budgetTransporte(),
    'Entretenimiento/salidas': this.budgetEntretenimiento(),
    Restaurantes: this.budgetRestaurantes(),
  }));

  constructor() {
    this.initRemoteConfig();
  }

  /**
   * Retorna el tope presupuestal configurado en Remote Config para una categoría dada,
   * o null si no tiene un tope predefinido.
   */
  getBudgetForCategory(category: string): number | null {
    const map = this.budgetsByCategory();
    return map[category] ?? null;
  }

  /**
   * Inicializa el SDK de Firebase y descarga los valores de Remote Config.
   * Tolerante a fallos si el cliente está fuera de línea o si no hay credenciales activas.
   */
  async initRemoteConfig(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const firebaseConfig = environment.firebase;
    // Si no hay configuración o estamos en pruebas unitarias sin API key real
    if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
      this.applyConfigValues(DEFAULT_REMOTE_CONFIG);
      this.isLoaded.set(true);
      return;
    }

    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const rc = getRemoteConfig(app);
      this.remoteConfigInstance = rc;

      // Criterio 1.2: Configuración de caché / fetch interval
      rc.settings.minimumFetchIntervalMillis = environment.production ? 3600000 : 0;
      rc.defaultConfig = DEFAULT_REMOTE_CONFIG as unknown as Record<string, string | number | boolean>;

      await fetchAndActivate(rc);

      // Criterio 2.1: Actualizar signals desde Remote Config
      this.dailyReminderMorningHour.set(getValue(rc, 'daily_reminder_morning_hour').asNumber() || DEFAULT_REMOTE_CONFIG.daily_reminder_morning_hour);
      this.dailyReminderEveningHour.set(getValue(rc, 'daily_reminder_evening_hour').asNumber() || DEFAULT_REMOTE_CONFIG.daily_reminder_evening_hour);
      this.dailyReminderHour.set(this.dailyReminderEveningHour());
      this.dailyReminderMessage.set(getValue(rc, 'daily_reminder_message').asString() || DEFAULT_REMOTE_CONFIG.daily_reminder_message);
      this.dailyReminderMorningMessage.set(getValue(rc, 'daily_reminder_morning_message').asString() || DEFAULT_REMOTE_CONFIG.daily_reminder_morning_message);
      this.dailyReminderEveningMessage.set(getValue(rc, 'daily_reminder_evening_message').asString() || DEFAULT_REMOTE_CONFIG.daily_reminder_evening_message);
      this.tcWeeklyBudget.set(getValue(rc, 'tc_weekly_budget').asNumber() || DEFAULT_REMOTE_CONFIG.tc_weekly_budget);
      this.budgetHogar.set(getValue(rc, 'budget_hogar').asNumber() || DEFAULT_REMOTE_CONFIG.budget_hogar);
      this.budgetAlimentacion.set(getValue(rc, 'budget_alimentacion').asNumber() || DEFAULT_REMOTE_CONFIG.budget_alimentacion);
      this.budgetRestaurantes.set(getValue(rc, 'budget_restaurantes').asNumber() || DEFAULT_REMOTE_CONFIG.budget_restaurantes);
      this.budgetTransporte.set(getValue(rc, 'budget_transporte').asNumber() || DEFAULT_REMOTE_CONFIG.budget_transporte);
      this.budgetEntretenimiento.set(getValue(rc, 'budget_entretenimiento').asNumber() || DEFAULT_REMOTE_CONFIG.budget_entretenimiento);
      this.alertThresholdPct.set(getValue(rc, 'alert_threshold_pct').asNumber() || DEFAULT_REMOTE_CONFIG.alert_threshold_pct);
      this.enablePushAlerts.set(getValue(rc, 'enable_push_alerts').asBoolean());

      this.isLoaded.set(true);
    } catch (err) {
      console.warn('Firebase Remote Config: Error al sincronizar, usando valores por defecto:', err);
      this.applyConfigValues(DEFAULT_REMOTE_CONFIG);
      this.isLoaded.set(true);
    }
  }

  private applyConfigValues(values: RemoteConfigValues): void {
    this.dailyReminderHour.set(values.daily_reminder_hour ?? values.daily_reminder_evening_hour);
    this.dailyReminderMorningHour.set(values.daily_reminder_morning_hour);
    this.dailyReminderEveningHour.set(values.daily_reminder_evening_hour);
    this.dailyReminderMessage.set(values.daily_reminder_message);
    this.dailyReminderMorningMessage.set(values.daily_reminder_morning_message);
    this.dailyReminderEveningMessage.set(values.daily_reminder_evening_message);
    this.tcWeeklyBudget.set(values.tc_weekly_budget);
    this.budgetHogar.set(values.budget_hogar);
    this.budgetAlimentacion.set(values.budget_alimentacion);
    this.budgetRestaurantes.set(values.budget_restaurantes);
    this.budgetTransporte.set(values.budget_transporte);
    this.budgetEntretenimiento.set(values.budget_entretenimiento);
    this.alertThresholdPct.set(values.alert_threshold_pct);
    this.enablePushAlerts.set(values.enable_push_alerts);
  }
}
