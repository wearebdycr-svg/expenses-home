import { TestBed } from '@angular/core/testing';
import { ExpensesService } from '../../gastos/data/expenses.service';
import { TcService } from './tc.service';

describe('TcService - Módulo TC Compartida y Conciliación', () => {
  let tcService: TcService;
  let expensesService: ExpensesService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    expensesService = TestBed.inject(ExpensesService);
    tcService = TestBed.inject(TcService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts with initial state and zero values when empty', () => {
    expect(tcService.totalConsumptions()).toBe(0);
    expect(tcService.totalPayments()).toBe(0);
    expect(tcService.pendingDebt()).toBe(0);
    expect(tcService.personFilter()).toBe('Todos');
  });

  it('adds direct TC consumption and updates totalConsumptions and pendingDebt', () => {
    tcService.addTcExpense({
      date: '2026-07-15',
      person: 'Benny',
      description: 'Supermercado Éxito',
      amount: 250_000,
      category: 'Supermercado',
    });

    expect(tcService.allTcExpenses().length).toBe(1);
    expect(tcService.totalConsumptions()).toBe(250_000);
    expect(tcService.pendingDebt()).toBe(250_000);
  });

  it('automatically reconciles and discounts debt when an expense with category TC-compartida is added to Gastos Diarios', () => {
    // 1. Registramos 2 consumos directos de la tarjeta por $500,000 en total
    tcService.addTcExpense({
      date: '2026-07-10',
      person: 'Benny',
      description: 'Tiquetes Aéreos',
      amount: 300_000,
      category: 'Viajes / Transporte',
    });

    tcService.addTcExpense({
      date: '2026-07-12',
      person: 'Charlie',
      description: 'Cena Aniversario',
      amount: 200_000,
      category: 'Entretenimiento/salidas',
    });

    expect(tcService.totalConsumptions()).toBe(500_000);
    expect(tcService.totalPayments()).toBe(0);
    expect(tcService.pendingDebt()).toBe(500_000);

    // 2. Registramos un gasto normal en Gastos Diarios (NO TC-compartida). No debe afectar la deuda de la TC.
    expensesService.addExpense({
      date: '2026-07-14',
      person: 'Benny',
      category: 'Mercado',
      description: 'Panadería',
      amount: 50_000,
    });

    expect(tcService.totalPayments()).toBe(0);
    expect(tcService.pendingDebt()).toBe(500_000);

    // 3. Registramos un gasto en Gastos Diarios con la categoría especial "TC-compartida" (Abono a la tarjeta)
    expensesService.addExpense({
      date: '2026-07-20',
      person: 'Charlie',
      category: 'TC-compartida',
      description: 'Pago Tarjeta Crédito Bancolombia',
      amount: 200_000,
    });

    // Debe reflejarse en tiempo real en los abonos y reducir la deuda pendiente
    // Deuda = 500,000 - 200,000 = 300,000
    expect(tcService.payments().length).toBe(1);
    expect(tcService.totalPayments()).toBe(200_000);
    expect(tcService.pendingDebt()).toBe(300_000);

    // 4. Se agrega otro abono por Benny por $300,000
    expensesService.addExpense({
      date: '2026-07-25',
      person: 'Benny',
      category: 'TC-compartida',
      description: 'Abono final cuota TC',
      amount: 300_000,
    });

    expect(tcService.payments().length).toBe(2);
    expect(tcService.totalPayments()).toBe(500_000);
    expect(tcService.pendingDebt()).toBe(0); // Deuda saldada totalmente
  });

  it('calculates person metrics correctly for both consumptions and payments', () => {
    tcService.addTcExpense({
      date: '2026-07-01',
      person: 'Benny',
      description: 'Computador',
      amount: 600_000,
    });

    tcService.addTcExpense({
      date: '2026-07-02',
      person: 'Charlie',
      description: 'Ropa',
      amount: 400_000,
    });

    expensesService.addExpense({
      date: '2026-07-10',
      person: 'Benny',
      category: 'TC-compartida',
      description: 'Abono Benny',
      amount: 300_000,
    });

    const metrics = tcService.personMetrics();
    const bennyMetric = metrics.find((m) => m.person === 'Benny')!;
    const charlieMetric = metrics.find((m) => m.person === 'Charlie')!;
    const compartidoMetric = metrics.find((m) => m.person === 'Compartido')!;

    expect(bennyMetric.consumptions).toBe(600_000);
    expect(bennyMetric.payments).toBe(300_000);
    expect(bennyMetric.netBalance).toBe(300_000);
    expect(bennyMetric.percentageOfConsumptions).toBe(60);

    expect(charlieMetric.consumptions).toBe(400_000);
    expect(charlieMetric.payments).toBe(0);
    expect(charlieMetric.netBalance).toBe(400_000);
    expect(charlieMetric.percentageOfConsumptions).toBe(40);

    expect(compartidoMetric.consumptions).toBe(0);
    expect(compartidoMetric.payments).toBe(0);
  });

  it('filters consumptions by person and search query', () => {
    tcService.addTcExpense({
      date: '2026-07-01',
      person: 'Benny',
      description: 'Monitor LG',
      amount: 150_000,
      category: 'Compras',
    });

    tcService.addTcExpense({
      date: '2026-07-02',
      person: 'Charlie',
      description: 'Zapatos Deportivos',
      amount: 200_000,
      category: 'Compras',
    });

    tcService.setPersonFilter('Benny');
    expect(tcService.filteredTcExpenses().length).toBe(1);
    expect(tcService.filteredTcExpenses()[0].person).toBe('Benny');

    tcService.setPersonFilter('Todos');
    tcService.setSearchQuery('Zapatos');
    expect(tcService.filteredTcExpenses().length).toBe(1);
    expect(tcService.filteredTcExpenses()[0].description).toBe('Zapatos Deportivos');
  });

  it('updates and deletes a direct TC consumption', () => {
    tcService.addTcExpense({
      date: '2026-07-05',
      person: 'Compartido',
      description: 'Mueble Sala',
      amount: 350_000,
    });

    const item = tcService.allTcExpenses()[0];
    tcService.updateTcExpense(item.id, {
      ...item,
      amount: 400_000,
      description: 'Mueble Sala Grande',
    });

    expect(tcService.allTcExpenses()[0].amount).toBe(400_000);
    expect(tcService.totalConsumptions()).toBe(400_000);

    tcService.deleteTcExpense(item.id);
    expect(tcService.allTcExpenses().length).toBe(0);
    expect(tcService.totalConsumptions()).toBe(0);
  });
});
