import { TestBed } from '@angular/core/testing';
import { IncomesService } from './incomes.service';

describe('IncomesService', () => {
  let service: IncomesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IncomesService);
  });

  it('filters by year, matching the "28 registros" seeded for 2026', () => {
    expect(service.filteredIncomes().length).toBe(28);
  });

  it('switches years without carrying over the previous year\'s records', () => {
    service.setYear(2025);
    expect(service.filteredIncomes().length).toBe(6);
    expect(service.filteredIncomes().every((i) => i.date.startsWith('2025'))).toBe(true);
  });

  it('filters by month while charts keep every month of the year', () => {
    service.setMonth(3);
    expect(service.filteredIncomes().every((i) => i.date.slice(5, 7) === '03')).toBe(true);
    expect(service.yearlyIncomes().length).toBe(28);
  });

  it('zeroes out the other person\'s totals when filtering by person', () => {
    service.setPerson('Ana');
    const totals = service.totals();
    expect(totals.carlos).toBe(0);
    expect(totals.total).toBe(totals.ana);
  });

  it('aggregates March exactly as shown in the tooltip mock', () => {
    const series = service.monthlySeries();
    expect(series.ana[2]).toBe(4_233_133);
    expect(series.carlos[2]).toBe(5_750_000);
  });

  it('adds, updates and deletes an income', () => {
    const before = service.filteredIncomes().length;
    service.addIncome({
      date: '2026-07-15',
      person: 'Ana',
      source: 'Otros',
      description: 'Test income',
      amount: 100_000,
    });
    expect(service.filteredIncomes().length).toBe(before + 1);

    const created = service.filteredIncomes().find((i) => i.description === 'Test income')!;
    service.updateIncome(created.id, { ...created, amount: 200_000 });
    expect(service.filteredIncomes().find((i) => i.id === created.id)?.amount).toBe(200_000);

    service.deleteIncome(created.id);
    expect(service.filteredIncomes().length).toBe(before);
  });
});
