import { TestBed } from '@angular/core/testing';
import { DebtsService } from './debts.service';
import { ExpensesService } from '../../gastos/data/expenses.service';
import { calculateAmortization } from './debt.model';

describe('DebtsService', () => {
  let service: DebtsService;
  let expensesService: ExpensesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DebtsService);
    expensesService = TestBed.inject(ExpensesService);
  });

  it('calculates French amortization properly matching the mockup values', () => {
    // Hipoteca: 64.5M saldo, 700k cuota, 8.5% tasa -> 150 meses
    const hipoteca = calculateAmortization({
      currentBalance: 64_500_000,
      monthlyPayment: 700_000,
      annualInterestRate: 8.5,
    });
    expect(hipoteca.remainingMonths).toBe(150);

    // Vehículo: 14.2M saldo, 450k cuota, 10.2% tasa -> 37 meses
    const vehiculo = calculateAmortization({
      currentBalance: 14_200_000,
      monthlyPayment: 450_000,
      annualInterestRate: 10.2,
    });
    expect(vehiculo.remainingMonths).toBe(37);

    // Tarjeta: 3.8M saldo, 500k cuota, 24.0% tasa -> 9 meses
    const tarjeta = calculateAmortization({
      currentBalance: 3_800_000,
      monthlyPayment: 500_000,
      annualInterestRate: 24.0,
    });
    expect(tarjeta.remainingMonths).toBe(9);
  });

  it('adds, updates and deletes a debt', async () => {
    await service.addDebt({
      name: 'Crédito Moto',
      person: 'Benny',
      startDate: '2026-09-01',
      originalAmount: 10_000_000,
      currentBalance: 8_000_000,
      monthlyPayment: 500_000,
      annualInterestRate: 12.0,
    });

    const debts = service.allDebts();
    expect(debts.length).toBeGreaterThan(0);
    const added = debts[debts.length - 1];
    expect(added.name).toBe('Crédito Moto');
    expect(service.summaryKpis().totalDebt).toBeGreaterThanOrEqual(8_000_000);

    // Update
    await service.updateDebt(added.id, {
      ...added,
      currentBalance: 7_500_000,
    });
    expect(service.allDebts().find((d) => d.id === added.id)?.currentBalance).toBe(7_500_000);

    // Delete
    await service.deleteDebt(added.id);
    expect(service.allDebts().find((d) => d.id === added.id)).toBeUndefined();
  });

  it('applies prepayment, reduces balance and adds expense to ExpensesService', async () => {
    await service.addDebt({
      name: 'Tarjeta Visa',
      person: 'Charlie',
      startDate: '2026-09-01',
      originalAmount: 5_000_000,
      currentBalance: 3_000_000,
      monthlyPayment: 400_000,
      annualInterestRate: 20.0,
    });

    const debt = service.allDebts().find((d) => d.name === 'Tarjeta Visa')!;
    const addExpenseSpy = vi.spyOn(expensesService, 'addExpense');

    await service.applyPrepayment({
      debtId: debt.id,
      amount: 500_000,
      date: '2026-09-29',
    });

    // Check balance reduced
    const updated = service.allDebts().find((d) => d.id === debt.id)!;
    expect(updated.currentBalance).toBe(2_500_000);

    // Check expense created in Gastos Diarios
    expect(addExpenseSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Abono a capital: Tarjeta Visa',
        amount: 500_000,
        category: 'Otros',
        person: 'Charlie',
        date: '2026-09-29',
      }),
    );
  });

  it('filters debts by person including Compartido', async () => {
    service['debts'].set([
      {
        id: '1',
        name: 'Hipoteca',
        person: 'Compartido',
        startDate: '2026-01-01',
        originalAmount: 80_000_000,
        currentBalance: 64_500_000,
        monthlyPayment: 700_000,
        annualInterestRate: 8.5,
        color: '#3b82f6',
      },
      {
        id: '2',
        name: 'Carro Benny',
        person: 'Benny',
        startDate: '2026-01-01',
        originalAmount: 20_000_000,
        currentBalance: 15_000_000,
        monthlyPayment: 500_000,
        annualInterestRate: 10.0,
        color: '#f59e0b',
      },
      {
        id: '3',
        name: 'Préstamo Charlie',
        person: 'Charlie',
        startDate: '2026-01-01',
        originalAmount: 10_000_000,
        currentBalance: 5_000_000,
        monthlyPayment: 300_000,
        annualInterestRate: 14.0,
        color: '#ef4444',
      },
    ]);

    service.setPerson('Benny');
    // Should include Benny AND Compartido
    const filtered = service.filteredDebts();
    expect(filtered.length).toBe(2);
    expect(filtered.some((d) => d.name === 'Hipoteca')).toBe(true);
    expect(filtered.some((d) => d.name === 'Carro Benny')).toBe(true);
    expect(filtered.some((d) => d.name === 'Préstamo Charlie')).toBe(false);
  });
});
