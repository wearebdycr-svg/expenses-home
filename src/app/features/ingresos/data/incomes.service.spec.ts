import { TestBed } from '@angular/core/testing';
import { IncomesService } from './incomes.service';

describe('IncomesService', () => {
  let service: IncomesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IncomesService);
  });

  it('starts with an empty list of incomes (0 records)', () => {
    expect(service.filteredIncomes().length).toBe(0);
  });

  it('adds an income for Benny and reflects it in totals and monthly series', () => {
    service.addIncome({
      date: '2026-03-15',
      person: 'Benny',
      source: 'Salario',
      description: 'Salario marzo',
      amount: 3_500_000,
    });

    expect(service.filteredIncomes().length).toBe(1);
    expect(service.totals().benny).toBe(3_500_000);
    expect(service.totals().charlie).toBe(0);
    expect(service.totals().total).toBe(3_500_000);
    expect(service.monthlySeries().benny[2]).toBe(3_500_000);
  });

  it('adds an income for Charlie and updates Charlie totals', () => {
    service.addIncome({
      date: '2026-03-20',
      person: 'Charlie',
      source: 'Arriendo',
      description: 'Arriendo marzo',
      amount: 700_000,
    });

    expect(service.totals().charlie).toBe(700_000);
    expect(service.monthlySeries().charlie[2]).toBe(700_000);
  });

  it('filters by person correctly', () => {
    service.addIncome({
      date: '2026-04-01',
      person: 'Benny',
      source: 'Salario',
      description: 'Salario',
      amount: 1_000_000,
    });
    service.addIncome({
      date: '2026-04-02',
      person: 'Charlie',
      source: 'Bono',
      description: 'Bono',
      amount: 500_000,
    });

    service.setPerson('Benny');
    expect(service.filteredIncomes().length).toBe(1);
    expect(service.filteredIncomes()[0].person).toBe('Benny');

    service.setPerson('Charlie');
    expect(service.filteredIncomes().length).toBe(1);
    expect(service.filteredIncomes()[0].person).toBe('Charlie');

    service.setPerson('Todos');
    expect(service.filteredIncomes().length).toBe(2);
  });

  it('adds, updates and deletes an income', () => {
    service.addIncome({
      date: '2026-07-15',
      person: 'Benny',
      source: 'Otros',
      description: 'Test income',
      amount: 100_000,
    });
    expect(service.filteredIncomes().length).toBe(1);

    const created = service.filteredIncomes()[0];
    service.updateIncome(created.id, { ...created, amount: 200_000 });
    expect(service.filteredIncomes().find((i) => i.id === created.id)?.amount).toBe(200_000);

    service.deleteIncome(created.id);
    expect(service.filteredIncomes().length).toBe(0);
  });
});
