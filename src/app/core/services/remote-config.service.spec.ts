import { TestBed } from '@angular/core/testing';
import {
  RemoteConfigService,
  DEFAULT_REMOTE_CONFIG,
} from './remote-config.service';
import { SupabaseService } from './supabase.service';

describe('RemoteConfigService', () => {
  let service: RemoteConfigService;
  let mockCategoryBudgetsData: any[] = [];
  let deleteCalls: string[] = [];
  let upsertCalls: any[] = [];

  const mockSupabase = {
    client: {
      from: (table: string) => {
        return {
          select: (_cols?: string) => {
            if (table === 'category_budgets') {
              return Promise.resolve({ data: mockCategoryBudgetsData, error: null });
            }
            return Promise.resolve({ data: [], error: null });
          },
          delete: () => {
            return {
              eq: (_col: string, val: string) => {
                deleteCalls.push(val);
                return Promise.resolve({ error: null });
              },
            };
          },
          upsert: (payload: any) => {
            upsertCalls.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      },
      channel: (_ch: string) => ({
        on: (_event: any, _config: any, _cb: any) => ({
          subscribe: () => ({ unsubscribe: () => {} }),
        }),
      }),
    },
  };

  beforeEach(() => {
    localStorage.clear();
    mockCategoryBudgetsData = [];
    deleteCalls = [];
    upsertCalls = [];

    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    });
    service = TestBed.inject(RemoteConfigService);
  });

  afterEach(() => {
    localStorage.clear();
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

  it('filters out sentinel __cron_* categories in getBudgetForCategory and budgetsByCategory', () => {
    // Intentar consultar una categoría de cron
    expect(service.getBudgetForCategory('__cron_fixed_expenses__')).toBeNull();
    expect(service.getBudgetForCategory('__cron_reminder_7pm__')).toBeNull();

    // Si customBudgets tuviera una clave de cron por accidente, budgetsByCategory debe ignorarla
    service['customBudgets'].set({
      '__cron_fixed_expenses__': 20261112,
      'Educación': 400_000,
    });

    const budgets = service.budgetsByCategory();
    expect(budgets['__cron_fixed_expenses__']).toBeUndefined();
    expect(budgets['Educación']).toBe(400_000);
    expect(service.getBudgetForCategory('__cron_fixed_expenses__')).toBeNull();
  });

  it('ignores setCategoryBudget for categories starting with __cron_', async () => {
    await service.setCategoryBudget('__cron_sentinel__', 500_000);
    expect(service.customBudgets()['__cron_sentinel__']).toBeUndefined();
    expect(service.getBudgetForCategory('__cron_sentinel__')).toBeNull();
    expect(upsertCalls.length).toBe(0);
  });

  it('deletes custom budget explicitly when amount is 0 or null, avoiding zombie values', async () => {
    // Asignar un presupuesto personalizado
    await service.setCategoryBudget('Educación', 600_000, true);
    expect(service.getBudgetForCategory('Educación')).toBe(600_000);
    expect(service.customBudgets()['Educación']).toBe(600_000);
    expect(upsertCalls.length).toBe(1);

    // Eliminar el presupuesto pasando 0
    await service.setCategoryBudget('Educación', 0, true);
    expect(service.getBudgetForCategory('Educación')).toBeNull();
    expect(service.customBudgets()['Educación']).toBeUndefined();
    expect(deleteCalls).toContain('Educación');

    // Eliminar pasando null
    await service.setCategoryBudget('Mascotas', 150_000, true);
    expect(service.getBudgetForCategory('Mascotas')).toBe(150_000);

    await service.setCategoryBudget('Mascotas', null, true);
    expect(service.getBudgetForCategory('Mascotas')).toBeNull();
    expect(service.customBudgets()['Mascotas']).toBeUndefined();
    expect(deleteCalls).toContain('Mascotas');
  });

  it('filters out __cron_* rows from Supabase response in loadBudgetsFromDb', async () => {
    mockCategoryBudgetsData = [
      { category: 'Educación', amount: 350_000 },
      { category: '__cron_fixed_expenses__', amount: 20261112 },
      { category: '__cron_reminder_7pm__', amount: 20261112 },
    ];

    await service.loadBudgetsFromDb(true);

    expect(service.getBudgetForCategory('Educación')).toBe(350_000);
    expect(service.getBudgetForCategory('__cron_fixed_expenses__')).toBeNull();
    expect(service.getBudgetForCategory('__cron_reminder_7pm__')).toBeNull();
    expect(service.customBudgets()['__cron_fixed_expenses__']).toBeUndefined();
    expect(service.customBudgets()['Educación']).toBe(350_000);
  });

  it('prevents deleted budgets from resurrecting from localStorage when DB is source of truth', async () => {
    // Simulamos que localStorage tenía guardado un presupuesto "Viajes" que fue borrado en la nube
    service['saveCustomBudgetsToStorage']({
      'Viajes': 1_200_000,
      'Educación': 500_000,
    });
    service['customBudgets'].set({
      'Viajes': 1_200_000,
      'Educación': 500_000,
    });

    expect(service.getBudgetForCategory('Viajes')).toBe(1_200_000);

    // En Supabase solo existe "Educación" (Viajes fue borrado)
    mockCategoryBudgetsData = [{ category: 'Educación', amount: 500_000 }];

    await service.loadBudgetsFromDb(true);

    // "Viajes" no debe resucitar
    expect(service.getBudgetForCategory('Viajes')).toBeNull();
    expect(service.customBudgets()['Viajes']).toBeUndefined();
    expect(service.getBudgetForCategory('Educación')).toBe(500_000);
  });
});
