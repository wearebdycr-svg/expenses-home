import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PushNotificationService } from './push-notification.service';
import { RemoteConfigService } from './remote-config.service';
import { ToastService } from './toast.service';
import type { Expense, ExpenseDraft } from '../../features/gastos/data/expense.model';

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let remoteConfig: RemoteConfigService;
  let toastService: ToastService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PushNotificationService);
    remoteConfig = TestBed.inject(RemoteConfigService);
    toastService = TestBed.inject(ToastService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should initialize with default states', () => {
    expect(service).toBeTruthy();
    expect(service.registeredPerson()).toBe('Hogar');
  });

  it('triggers shared expense push when person is Compartido (Criterio 4.1)', async () => {
    const dispatchSpy = vi.spyOn(service, 'dispatchPushNotification').mockResolvedValue();

    const sharedDraft: ExpenseDraft = {
      date: '2026-07-15',
      person: 'Compartido',
      category: 'Hogar',
      description: 'Arriendo',
      amount: 1_200_000,
    };

    await service.handleExpenseCreated(sharedDraft, []);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '💸 Nuevo Gasto Compartido',
        targetPerson: 'all',
      })
    );
  });

  it('triggers budget risk alert when accumulated expenses exceed threshold (Criterio 3.1 & 3.2)', async () => {
    const dispatchSpy = vi.spyOn(service, 'dispatchPushNotification').mockResolvedValue();

    // budget_transporte is 800_000, 80% is 640_000
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curDate = `${curYear}-${curMonth}-10`;

    const monthlyExpenses: Expense[] = [
      {
        id: '1',
        date: curDate,
        person: 'Benny',
        category: 'Transporte',
        description: 'Gasolina parte 1',
        amount: 400_000,
      },
      {
        id: '2',
        date: curDate,
        person: 'Benny',
        category: 'Transporte',
        description: 'Gasolina parte 2',
        amount: 300_000,
      },
    ];

    // Total 700_000 >= 640_000 (87.5%)
    const newDraft: ExpenseDraft = {
      date: curDate,
      person: 'Benny',
      category: 'Transporte',
      description: 'Gasolina parte 2',
      amount: 300_000,
    };

    await service.handleExpenseCreated(newDraft, monthlyExpenses);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '⚠️ Tope Financiero en Riesgo',
        data: expect.objectContaining({
          click_action: '/#categoria',
        }),
      })
    );
  });

  it('does not trigger budget alert when below threshold', async () => {
    const dispatchSpy = vi.spyOn(service, 'dispatchPushNotification').mockResolvedValue();

    const now = new Date();
    const curDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-05`;

    const monthlyExpenses: Expense[] = [
      {
        id: '1',
        date: curDate,
        person: 'Charlie',
        category: 'Transporte',
        description: 'Peaje',
        amount: 100_000,
      },
    ];

    const newDraft: ExpenseDraft = {
      date: curDate,
      person: 'Charlie',
      category: 'Transporte',
      description: 'Peaje',
      amount: 100_000,
    };

    await service.handleExpenseCreated(newDraft, monthlyExpenses);

    // Only 100k out of 800k (< 80%), so budget alert is NOT triggered
    expect(dispatchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: '⚠️ Tope Financiero en Riesgo',
      })
    );
  });

  it('does not trigger alerts when enablePushAlerts is false', async () => {
    remoteConfig.enablePushAlerts.set(false);
    const dispatchSpy = vi.spyOn(service, 'dispatchPushNotification').mockResolvedValue();

    const sharedDraft: ExpenseDraft = {
      date: '2026-07-15',
      person: 'Compartido',
      category: 'Hogar',
      description: 'Mantenimiento',
      amount: 500_000,
    };

    await service.handleExpenseCreated(sharedDraft, []);

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('requests native permissions and registers push on native platform', async () => {
    vi.spyOn(service, 'isNative').mockReturnValue(true);
    const nativeSpy = vi.spyOn(service, 'requestNativeSubscription').mockResolvedValue('test-fcm-token');

    const result = await service.requestSubscription();

    expect(nativeSpy).toHaveBeenCalled();
    expect(result).toBe('test-fcm-token');
  });

  it('schedules LocalNotification on native platform in showSystemNotification', async () => {
    vi.spyOn(service, 'isNative').mockReturnValue(true);
    const scheduleSpy = vi.spyOn(service, 'scheduleNativeNotification').mockResolvedValue();

    await service.showSystemNotification('Prueba Nativa', 'Cuerpo prueba', '/#tc-compartida');

    expect(scheduleSpy).toHaveBeenCalledWith('Prueba Nativa', 'Cuerpo prueba', '/#tc-compartida');
  });
});
