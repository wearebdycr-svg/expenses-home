import { TestBed } from '@angular/core/testing';
import { ExpensesService } from '../../gastos/data/expenses.service';
import { IncomesService } from '../../ingresos/data/incomes.service';
import { ResumenService } from './resumen.service';

describe('ResumenService', () => {
  let service: ResumenService;
  let incomesService: IncomesService;
  let expensesService: ExpensesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ResumenService);
    incomesService = TestBed.inject(IncomesService);
    expensesService = TestBed.inject(ExpensesService);
    service.setYear(2026);
    service.setPerson('Todos');
  });

  it('starts with zero totals when there are no records', () => {
    const kpis = service.kpis();
    expect(kpis.totalIncomeYTD).toBe(0);
    expect(kpis.totalExpenseYTD).toBe(0);
    expect(kpis.balanceYTD).toBe(0);
    expect(kpis.averageIncomeMonthly).toBe(0);
    expect(kpis.averageExpenseMonthly).toBe(0);
    expect(kpis.savingsRateYTD).toBe(0);
    expect(kpis.monthsWithDataCount).toBe(0);
  });

  it('calculates monthly summary rows, balances and savings rate correctly', () => {
    // Agregar ingreso en Enero para Benny
    incomesService.addIncome({
      date: '2026-01-15',
      person: 'Benny',
      source: 'Salario',
      description: 'Nómina',
      amount: 4_000_000,
    });
    // Agregar ingreso en Enero para Charlie
    incomesService.addIncome({
      date: '2026-01-20',
      person: 'Charlie',
      source: 'Salario',
      description: 'Nómina',
      amount: 6_000_000,
    });
    // Agregar gasto en Enero para Compartido
    expensesService.addExpense({
      date: '2026-01-10',
      person: 'Compartido',
      category: 'Hogar',
      description: 'Arriendo',
      amount: 4_000_000,
    });

    const rows = service.summaryRows();
    const enero = rows[0];

    expect(enero.hasData).toBe(true);
    expect(enero.incomeBenny).toBe(4_000_000);
    expect(enero.incomeCharlie).toBe(6_000_000);
    expect(enero.totalIncome).toBe(10_000_000);
    expect(enero.expenseCompartido).toBe(4_000_000);
    expect(enero.totalExpense).toBe(4_000_000);
    expect(enero.balance).toBe(6_000_000);
    expect(enero.cumulativeBalance).toBe(6_000_000);
    expect(enero.savingsRate).toBe(60);

    const kpis = service.kpis();
    expect(kpis.totalIncomeYTD).toBe(10_000_000);
    expect(kpis.totalExpenseYTD).toBe(4_000_000);
    expect(kpis.balanceYTD).toBe(6_000_000);
    expect(kpis.monthsWithDataCount).toBe(1);
    expect(kpis.averageIncomeMonthly).toBe(10_000_000);
    expect(kpis.averageExpenseMonthly).toBe(4_000_000);
    expect(kpis.savingsRateYTD).toBe(60);
  });

  it('filters summary rows when a specific person is selected', () => {
    service.setPerson('Benny');
    const kpis = service.kpis();
    expect(kpis.totalIncomeYTD).toBe(0);
    expect(service.person()).toBe('Benny');
  });
});
