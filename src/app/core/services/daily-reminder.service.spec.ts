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

  it('does not show reminder before reminder hour (e.g. 6:00 PM)', () => {
    const beforeHour = new Date(2026, 8, 30, 18, 0, 0); // 6:00 PM
    expect(service.shouldShowReminder(beforeHour)).toBe(false);
  });

  it('shows evening reminder at or after 19:00 (7:00 PM) when no expenses exist today', () => {
    const atEveningHour = new Date(2026, 8, 30, 19, 15, 0); // 7:15 PM
    expect(service.shouldShowReminder(atEveningHour)).toBe(true);
  });

  it('does not show reminder if expenses already exist for today', () => {
    const atHour = new Date(2026, 8, 30, 19, 30, 0);
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

  it('does not show reminder if already dismissed for current slot today', () => {
    const atHour = new Date(2026, 8, 30, 19, 15, 0);
    const todayStr = getLocalDateIso(atHour);
    localStorage.setItem(REMINDER_STORAGE_KEY, `${todayStr}_evening`);

    expect(service.shouldShowReminder(atHour)).toBe(false);
  });

  it('dismisses for current slot and writes to localStorage', () => {
    service.showBanner.set(true);

    service.dismissForToday();

    expect(service.showBanner()).toBe(false);
    expect(localStorage.getItem(REMINDER_STORAGE_KEY)).toContain(getLocalDateIso());
  });
});
