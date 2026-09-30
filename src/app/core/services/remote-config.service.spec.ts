import { TestBed } from '@angular/core/testing';
import {
  RemoteConfigService,
  DEFAULT_REMOTE_CONFIG,
} from './remote-config.service';

describe('RemoteConfigService', () => {
  let service: RemoteConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RemoteConfigService);
  });

  it('should be created and have default config loaded', () => {
    expect(service).toBeTruthy();
    expect(service.dailyReminderHour()).toBe(DEFAULT_REMOTE_CONFIG.daily_reminder_hour);
    expect(service.dailyReminderMessage()).toBe(DEFAULT_REMOTE_CONFIG.daily_reminder_message);
    expect(service.budgetHogar()).toBe(DEFAULT_REMOTE_CONFIG.budget_hogar);
    expect(service.budgetAlimentacion()).toBe(DEFAULT_REMOTE_CONFIG.budget_alimentacion);
    expect(service.budgetRestaurantes()).toBe(DEFAULT_REMOTE_CONFIG.budget_restaurantes);
    expect(service.budgetTransporte()).toBe(DEFAULT_REMOTE_CONFIG.budget_transporte);
    expect(service.budgetEntretenimiento()).toBe(DEFAULT_REMOTE_CONFIG.budget_entretenimiento);
    expect(service.alertThresholdPct()).toBe(DEFAULT_REMOTE_CONFIG.alert_threshold_pct);
    expect(service.enablePushAlerts()).toBe(DEFAULT_REMOTE_CONFIG.enable_push_alerts);
  });

  it('maps budget by category correctly', () => {
    expect(service.getBudgetForCategory('Hogar')).toBe(2_500_000);
    expect(service.getBudgetForCategory('Mercado')).toBe(2_000_000);
    expect(service.getBudgetForCategory('Transporte')).toBe(800_000);
    expect(service.getBudgetForCategory('Entretenimiento/salidas')).toBe(500_000);
    expect(service.getBudgetForCategory('Educación')).toBeNull();
  });
});
