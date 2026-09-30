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

  it('calculates remaining months accurately when totalMonths is defined', () => {
    // 12 months total, 12M original, 1M monthly payment
    const debtStart = calculateAmortization({
      currentBalance: 12_000_000,
      monthlyPayment: 1_000_000,
      annualInterestRate: 0,
      totalMonths: 12,
    });
    expect(debtStart.remainingMonths).toBe(12);

    // After 1 payment of 1M -> 11M remaining -> 11 months
    const debtAfter1Payment = calculateAmortization({
      currentBalance: 11_000_000,
      monthlyPayment: 1_000_000,
      annualInterestRate: 0,
      totalMonths: 12,
    });
    expect(debtAfter1Payment.remainingMonths).toBe(11);

    // After 5 payments -> 7M remaining -> 7 months
    const debtAfter5Payments = calculateAmortization({
      currentBalance: 7_000_000,
      monthlyPayment: 1_000_000,
      annualInterestRate: 0,
      totalMonths: 12,
    });
    expect(debtAfter5Payments.remainingMonths).toBe(7);

    // Settled debt -> 0 months
    const debtSettled = calculateAmortization({
      currentBalance: 0,
      monthlyPayment: 1_000_000,
      annualInterestRate: 0,
      totalMonths: 12,
    });
    expect(debtSettled.remainingMonths).toBe(0);
    expect(debtSettled.projectedDateFormatted).toBe('Liquidada');
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
        category: 'Tarjeta Visa',
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

  it('calculates live balance and auto-settles debt when amortized amount reaches balance', async () => {
    service['debts'].set([
      {
        id: 'debt-auto-settle',
        name: 'Crédito Estudio',
        person: 'Benny',
        startDate: '2026-01-01',
        originalAmount: 2_000_000,
        currentBalance: 2_000_000,
        monthlyPayment: 200_000,
        annualInterestRate: 0,
        color: '#3b82f6',
        status: 'activa',
      },
    ]);

    // Initial check: active with full balance
    let debt = service.allDebts().find((d) => d.id === 'debt-auto-settle')!;
    expect(debt.currentBalance).toBe(2_000_000);
    expect(debt.status).toBe('activa');
    expect(service.activeDebts().some((d) => d.id === 'debt-auto-settle')).toBe(true);

    // Add partial expense
    await expensesService.addExpense({
      date: '2026-09-29',
      person: 'Benny',
      category: 'Crédito Estudio',
      description: 'Pago cuota 1',
      amount: 1_200_000,
    });

    debt = service.allDebts().find((d) => d.id === 'debt-auto-settle')!;
    expect(debt.currentBalance).toBe(800_000);
    expect(debt.status).toBe('activa');

    // Add remaining expense to pay off debt completely
    await expensesService.addExpense({
      date: '2026-09-30',
      person: 'Benny',
      category: 'Crédito Estudio',
      description: 'Pago cuota 2 saldo total',
      amount: 800_000,
    });

    debt = service.allDebts().find((d) => d.id === 'debt-auto-settle')!;
    expect(debt.currentBalance).toBe(0);
    expect(debt.status).toBe('saldada');
    // Once settled, it should no longer be in activeDebts()
    expect(service.activeDebts().some((d) => d.id === 'debt-auto-settle')).toBe(false);
  });

  it('renames expenses in cascade when debt name is updated', async () => {
    service['debts'].set([
      {
        id: 'debt-rename-test',
        name: 'Préstamo Antiguo',
        person: 'Charlie',
        startDate: '2026-01-01',
        originalAmount: 1_000_000,
        currentBalance: 1_000_000,
        monthlyPayment: 100_000,
        annualInterestRate: 5,
        color: '#10b981',
        status: 'activa',
      },
    ]);

    await expensesService.addExpense({
      date: '2026-09-29',
      person: 'Charlie',
      category: 'Préstamo Antiguo',
      description: 'Abono inicial',
      amount: 300_000,
    });

    // Rename debt
    await service.updateDebt('debt-rename-test', {
      name: 'Préstamo Nuevo',
      person: 'Charlie',
      startDate: '2026-01-01',
      originalAmount: 1_000_000,
      currentBalance: 1_000_000,
      monthlyPayment: 100_000,
      annualInterestRate: 5,
    });

    // Check that expense category was updated in cascade
    const expense = expensesService.allExpenses().find((e) => e.description === 'Abono inicial')!;
    expect(expense.category).toBe('Préstamo Nuevo');

    // Live balance should now track with the new name
    const debt = service.allDebts().find((d) => d.id === 'debt-rename-test')!;
    expect(debt.name).toBe('Préstamo Nuevo');
    expect(debt.currentBalance).toBe(700_000);
  });
});
