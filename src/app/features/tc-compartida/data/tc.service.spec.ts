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
    tcService.setYear(2026);
    tcService.setMonth(7);
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

  it('filters consumptions and payments by month correctly', () => {
    tcService.addTcExpense({
      date: '2026-07-15',
      person: 'Benny',
      description: 'Julio gasto',
      amount: 100_000,
      category: 'Mercado',
    });
    tcService.addTcExpense({
      date: '2026-08-15',
      person: 'Charlie',
      description: 'Agosto gasto',
      amount: 200_000,
      category: 'Compras',
    });

    tcService.setMonth(7);
    expect(tcService.filteredTcExpenses().length).toBe(1);
    expect(tcService.totalConsumptions()).toBe(100_000);

    tcService.setMonth(8);
    expect(tcService.filteredTcExpenses().length).toBe(1);
    expect(tcService.totalConsumptions()).toBe(200_000);

    tcService.setMonth('Todos');
    expect(tcService.filteredTcExpenses().length).toBe(2);
    expect(tcService.totalConsumptions()).toBe(300_000);
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

  it('calculates currentWeekTotal correctly for expenses in the current week', () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    tcService.addTcExpense({
      date: todayStr,
      person: 'Benny',
      description: 'Supermercado semana',
      amount: 120_000,
      category: 'Mercado',
    });

    expect(tcService.currentWeekTotal()).toBe(120_000);
  });

  it('correctly associates payments from Gastos to specific credit cards and discounts debt', () => {
    const nuCard = tcService.cards().find((c) => c.id === 'tc-nu-charlie')!;
    tcService.selectCard(nuCard);

    // 1. Consumo en TC Nu
    tcService.addTcExpense({
      date: '2026-07-10',
      person: 'Charlie',
      description: 'Compra en Amazon',
      amount: 150_000,
      cardId: 'tc-nu-charlie',
    });

    expect(tcService.totalConsumptions()).toBe(150_000);
    expect(tcService.totalPayments()).toBe(0);
    expect(tcService.pendingDebt()).toBe(150_000);

    // 2. Abono registrado en Gastos Diarios con la categoría de la tarjeta
    expensesService.addExpense({
      date: '2026-07-15',
      person: 'Charlie',
      category: 'TC: TC Nu Charlie',
      description: 'Pago mensual Nu',
      amount: 100_000,
    });

    // Debe conciliarse en Nu y restar su deuda a 50.000
    expect(tcService.totalPayments()).toBe(100_000);
    expect(tcService.pendingDebt()).toBe(50_000);
    expect(tcService.payments().length).toBe(1);
    expect(tcService.payments()[0].description).toBe('Pago mensual Nu');

    // TC Compartida no debe verse afectada por el pago de Nu
    const sharedCard = tcService.cards().find((c) => c.id === 'tc-compartida')!;
    tcService.selectCard(sharedCard);
    expect(tcService.totalConsumptions()).toBe(0);
    expect(tcService.totalPayments()).toBe(0);
  });

  it('correctly calculates cumulative pendingDebt when a current-month payment settles prior-month debt', () => {
    const sharedCard = tcService.cards().find((c) => c.id === 'tc-compartida')!;
    tcService.selectCard(sharedCard);

    // 1. Deuda del mes anterior (Julio): Consumo $3.783.314
    tcService.addTcExpense({
      date: '2026-07-20',
      person: 'Compartido',
      description: 'Gasto anterior',
      amount: 3_783_314,
      cardId: 'tc-compartida',
    });

    // 2. En Octubre se paga el saldo anterior ($3.783.314) y se hace una nueva compra ($50.000)
    expensesService.addExpense({
      date: '2026-10-01',
      person: 'Charlie',
      category: 'TC-compartida',
      description: 'Pago saldo anterior',
      amount: 3_783_314,
    });

    tcService.addTcExpense({
      date: '2026-10-01',
      person: 'Compartido',
      description: 'D1 comida',
      amount: 50_000,
      cardId: 'tc-compartida',
    });

    // Filtro en Octubre
    tcService.setMonth(10);

    // Consumos del mes de Octubre: $50.000
    expect(tcService.totalConsumptions()).toBe(50_000);

    // Abonos del mes de Octubre: $3.783.314
    expect(tcService.totalPayments()).toBe(3_783_314);

    // Deuda pendiente real: NO debe ser $0, debe ser exactamente $50.000 (la nueva compra)
    // porque el pago de $3.783.314 cubrió el saldo de Julio
    expect(tcService.pendingDebt()).toBe(50_000);
  });

  it('does NOT allow prior-month payments (e.g. from months before TC table existed) to cancel future consumptions', () => {
    const sharedCard = tcService.cards().find((c) => c.id === 'tc-compartida')!;
    tcService.selectCard(sharedCard);

    // 1. Pago histórico en Julio ($1.000.000) en Gastos Diarios
    expensesService.addExpense({
      date: '2026-07-15',
      person: 'Charlie',
      category: 'TC-compartida',
      description: 'Pago cuota anterior',
      amount: 1_000_000,
    });

    // 2. Nuevo consumo en Octubre ($34.320)
    tcService.addTcExpense({
      date: '2026-10-01',
      person: 'Compartido',
      description: 'Café y compras',
      amount: 34_320,
      cardId: 'tc-compartida',
    });

    tcService.setMonth(10);

    // Consumos en Octubre: 34.320
    expect(tcService.totalConsumptions()).toBe(34_320);

    // Abonos en Octubre: 0
    expect(tcService.totalPayments()).toBe(0);

    // Deuda pendiente en Octubre: NO debe ser $0 por el abono de Julio, debe ser $34.320
    expect(tcService.pendingDebt()).toBe(34_320);

    // Y el grid de tarjetas también debe reflejar $34.320 de deuda pendiente
    const metrics = tcService.getCardMetrics('tc-compartida');
    expect(metrics.pendingDebt).toBe(34_320);
  });

  it('does NOT match unrelated expenses with bank or shared words as credit card payments', () => {
    const sharedCard = tcService.cards().find((c) => c.id === 'tc-compartida')!;

    // Gasto regular de restaurante con la palabra "compartida"
    const restaurantExpense = {
      id: 'e1',
      date: '2026-10-01',
      person: 'Charlie' as const,
      category: 'Restaurantes',
      description: 'Cena compartida con amigos',
      amount: 120_000,
      createdAt: '2026-10-01T00:00:00Z',
    };
    expect(tcService.isPaymentForCard(restaurantExpense, sharedCard)).toBe(false);

    // Gasto regular con la palabra "bancolombia" en servicios
    const transferExpense = {
      id: 'e2',
      date: '2026-10-01',
      person: 'Benny' as const,
      category: 'Servicios',
      description: 'Transferencia Bancolombia arriendo',
      amount: 500_000,
      createdAt: '2026-10-01T00:00:00Z',
    };
    expect(tcService.isPaymentForCard(transferExpense, sharedCard)).toBe(false);

    // Pago legítimo de tarjeta
    const legitPayment = {
      id: 'e3',
      date: '2026-10-01',
      person: 'Charlie' as const,
      category: 'TC-compartida',
      description: 'Pago tarjeta Bancolombia 0066',
      amount: 34_320,
      createdAt: '2026-10-01T00:00:00Z',
    };
    expect(tcService.isPaymentForCard(legitPayment, sharedCard)).toBe(true);
  });
});

