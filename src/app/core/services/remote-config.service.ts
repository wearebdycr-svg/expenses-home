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
  daily_reminder_hour: number;
  daily_reminder_message: string;
  budget_hogar: number;
  budget_alimentacion: number;
  budget_restaurantes: number;
  budget_transporte: number;
  budget_entretenimiento: number;
  alert_threshold_pct: number;
  enable_push_alerts: boolean;
}

export const DEFAULT_REMOTE_CONFIG: RemoteConfigValues = {
  daily_reminder_hour: 20,
  daily_reminder_message: '¿Tuviste gastos hoy? No olvides reportar los gastos de hoy',
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
  readonly dailyReminderHour = signal<number>(DEFAULT_REMOTE_CONFIG.daily_reminder_hour);
  readonly dailyReminderMessage = signal<string>(DEFAULT_REMOTE_CONFIG.daily_reminder_message);
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
      this.dailyReminderHour.set(getValue(rc, 'daily_reminder_hour').asNumber());
      this.dailyReminderMessage.set(getValue(rc, 'daily_reminder_message').asString());
      this.budgetHogar.set(getValue(rc, 'budget_hogar').asNumber());
      this.budgetAlimentacion.set(getValue(rc, 'budget_alimentacion').asNumber());
      this.budgetRestaurantes.set(getValue(rc, 'budget_restaurantes').asNumber());
      this.budgetTransporte.set(getValue(rc, 'budget_transporte').asNumber());
      this.budgetEntretenimiento.set(getValue(rc, 'budget_entretenimiento').asNumber());
      this.alertThresholdPct.set(getValue(rc, 'alert_threshold_pct').asNumber());
      this.enablePushAlerts.set(getValue(rc, 'enable_push_alerts').asBoolean());

      this.isLoaded.set(true);
    } catch (err) {
      console.warn('Firebase Remote Config: Error al sincronizar, usando valores por defecto:', err);
      this.applyConfigValues(DEFAULT_REMOTE_CONFIG);
      this.isLoaded.set(true);
    }
  }

  private applyConfigValues(values: RemoteConfigValues): void {
    this.dailyReminderHour.set(values.daily_reminder_hour);
    this.dailyReminderMessage.set(values.daily_reminder_message);
    this.budgetHogar.set(values.budget_hogar);
    this.budgetAlimentacion.set(values.budget_alimentacion);
    this.budgetRestaurantes.set(values.budget_restaurantes);
    this.budgetTransporte.set(values.budget_transporte);
    this.budgetEntretenimiento.set(values.budget_entretenimiento);
    this.alertThresholdPct.set(values.alert_threshold_pct);
    this.enablePushAlerts.set(values.enable_push_alerts);
  }
}
