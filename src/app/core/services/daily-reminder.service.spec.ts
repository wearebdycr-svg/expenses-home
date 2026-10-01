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

  it('does not show reminder before morning reminder hour (e.g. 8:00 AM)', () => {
    const beforeHour = new Date(2026, 8, 30, 8, 0, 0); // 8:00 AM
    expect(service.shouldShowReminder(beforeHour)).toBe(false);
  });

  it('shows morning reminder at or after 9:00 AM when no expenses exist today', () => {
    const atMorningHour = new Date(2026, 8, 30, 9, 30, 0); // 9:30 AM
    expect(service.shouldShowReminder(atMorningHour)).toBe(true);
  });

  it('shows evening reminder at or after 21:00 (9:00 PM) when no expenses exist today', () => {
    const atEveningHour = new Date(2026, 8, 30, 21, 15, 0); // 9:15 PM
    expect(service.shouldShowReminder(atEveningHour)).toBe(true);
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

  it('does not show reminder if already dismissed for current slot today', () => {
    const atHour = new Date(2026, 8, 30, 9, 15, 0);
    const todayStr = getLocalDateIso(atHour);
    localStorage.setItem(REMINDER_STORAGE_KEY, `${todayStr}_morning`);

    expect(service.shouldShowReminder(atHour)).toBe(false);
  });

  it('dismisses for current slot and writes to localStorage', () => {
    service.showBanner.set(true);

    service.dismissForToday();

    expect(service.showBanner()).toBe(false);
    expect(localStorage.getItem(REMINDER_STORAGE_KEY)).toContain(getLocalDateIso());
  });
});
