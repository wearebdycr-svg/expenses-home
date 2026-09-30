import { TestBed } from '@angular/core/testing';
import {
  DailyReminderService,
  REMINDER_STORAGE_KEY,
  getLocalDateIso,
} from './daily-reminder.service';
import { ExpensesService } from '../../features/gastos/data/expenses.service';

describe('DailyReminderService', () => {
  let service: DailyReminderService;
  let expensesService: ExpensesService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(DailyReminderService);
    expensesService = TestBed.inject(ExpensesService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('does not show reminder before reminder hour (e.g. 19:00)', () => {
    const beforeHour = new Date(2026, 8, 30, 19, 0, 0); // 7:00 PM
    expect(service.shouldShowReminder(beforeHour)).toBe(false);
  });

  it('shows reminder at or after reminder hour (20:00) when no expenses exist today', () => {
    const atHour = new Date(2026, 8, 30, 20, 30, 0); // 8:30 PM
    expect(service.shouldShowReminder(atHour)).toBe(true);
  });

  it('does not show reminder if expenses already exist for today', () => {
    const atHour = new Date(2026, 8, 30, 21, 0, 0);
    const todayStr = getLocalDateIso(atHour);

    expensesService['expenses'].set([
      {
        id: 'test-exp-today',
        date: todayStr,
        person: 'Charlie',
        category: 'Mercado',
        description: 'Compra en D1',
        amount: 25000,
      },
    ]);

    expect(service.shouldShowReminder(atHour)).toBe(false);
  });

  it('does not show reminder if already dismissed today', () => {
    const atHour = new Date(2026, 8, 30, 20, 15, 0);
    const todayStr = getLocalDateIso(atHour);
    localStorage.setItem(REMINDER_STORAGE_KEY, todayStr);

    expect(service.shouldShowReminder(atHour)).toBe(false);
  });

  it('dismisses for today and writes to localStorage', () => {
    const atHour = new Date(2026, 8, 30, 21, 0, 0);
    service.showBanner.set(true);

    service.dismissForToday();

    expect(service.showBanner()).toBe(false);
    expect(localStorage.getItem(REMINDER_STORAGE_KEY)).toBe(getLocalDateIso());
  });
});
