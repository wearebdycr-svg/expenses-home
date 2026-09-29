import { TestBed } from '@angular/core/testing';
import { ExpensesService } from './expenses.service';

describe('ExpensesService', () => {
  let service: ExpensesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExpensesService);
  });

  it('defaults to current year and current month', () => {
    const now = new Date();
    expect(service.year()).toBe(now.getFullYear());
    expect(service.month()).toBe(now.getMonth() + 1);
  });

  describe('with July 2026 filter', () => {
    beforeEach(() => {
      service.setYear(2026);
      service.setMonth(7);
    });

    it('starts with an empty list of expenses (0 records)', () => {
    expect(service.filteredExpenses().length).toBe(0);
    expect(service.totalPeriod()).toBe(0);
    expect(service.transactionCount()).toBe(0);
  });

  it('adds an expense and updates totalPeriod and transactionCount', () => {
    service.addExpense({
      date: '2026-07-28',
      person: 'Compartido',
      category: 'Alimentación',
      description: 'Supermercado',
      amount: 161_657,
    });

    expect(service.transactionCount()).toBe(1);
    expect(service.totalPeriod()).toBe(161_657);
    expect(service.filteredExpenses()[0].description).toBe('Supermercado');
  });

  it('calculates category breakdown percentages properly', () => {
    service.addExpense({
      date: '2026-07-05',
      person: 'Compartido',
      category: 'Hogar',
      description: 'Arriendo',
      amount: 1_800_000,
    });
    service.addExpense({
      date: '2026-07-10',
      person: 'Benny',
      category: 'Alimentación',
      description: 'Mercado',
      amount: 200_000,
    });

    const breakdown = service.categoryBreakdown();
    expect(breakdown.length).toBe(2);
    expect(breakdown[0].category).toBe('Hogar');
    expect(breakdown[0].amount).toBe(1_800_000);
    expect(breakdown[0].percentage).toBe(90);
    expect(breakdown[1].category).toBe('Alimentación');
    expect(breakdown[1].percentage).toBe(10);
  });

  it('calculates daily series for stacked bar chart', () => {
    service.addExpense({
      date: '2026-07-09',
      person: 'Charlie',
      category: 'Restaurantes',
      description: 'Sushi',
      amount: 90_000,
    });

    const series = service.dailySeries();
    // Index 8 is Day 9
    expect(series.charlie[8]).toBe(90_000);
    expect(series.benny[8]).toBe(0);
    expect(series.compartido[8]).toBe(0);
    expect(series.total[8]).toBe(90_000);
  });

  it('updates and deletes an expense', () => {
    service.addExpense({
      date: '2026-07-25',
      person: 'Benny',
      category: 'Entretenimiento',
      description: 'Cine',
      amount: 28_216,
    });

    const created = service.filteredExpenses()[0];
    service.updateExpense(created.id, { ...created, amount: 35_000 });
    expect(service.filteredExpenses().find((e) => e.id === created.id)?.amount).toBe(35_000);

    service.deleteExpense(created.id);
    expect(service.filteredExpenses().length).toBe(0);
  });
});
});
