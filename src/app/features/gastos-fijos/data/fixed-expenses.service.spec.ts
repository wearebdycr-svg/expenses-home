import { TestBed } from '@angular/core/testing';
import { FixedExpensesService } from './fixed-expenses.service';
import { ExpensesService } from '../../gastos/data/expenses.service';

describe('FixedExpensesService - Gastos Fijos Mensuales', () => {
  let service: FixedExpensesService;
  let expensesService: ExpensesService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(FixedExpensesService);
    expensesService = TestBed.inject(ExpensesService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts with empty fixed expenses when storage is clean', () => {
    expect(service.fixedExpenses().length).toBe(0);
    expect(service.activeFixedExpenses().length).toBe(0);
    expect(service.summary().totalFixed).toBe(0);
  });

  it('creates a fixed expense and lists it in activeFixedExpenses', async () => {
    const fixed = await service.addFixedExpense({
      name: 'Somos Internet',
      expectedAmount: 85_000,
      person: 'Compartido',
      dueDay: 5,
      status: 'activo',
      notes: 'Fibra óptica hogar',
    });

    expect(fixed.name).toBe('Somos Internet');
    expect(fixed.expectedAmount).toBe(85_000);
    expect(service.activeFixedExpenses().length).toBe(1);
    expect(service.activeFixedExpenses()[0].name).toBe('Somos Internet');
  });

  it('marks fixed expense as paid automatically when an expense is registered in that month', async () => {
    service.setYear(2026);
    service.setMonth(11); // Noviembre 2026

    await service.addFixedExpense({
      name: 'Somos Internet',
      expectedAmount: 85_000,
      person: 'Compartido',
      dueDay: 5,
      status: 'activo',
    });

    // Antes de pagar: debe estar pendiente
    let statuses = service.monthlyStatuses();
    expect(statuses.length).toBe(1);
    expect(statuses[0].isPaid).toBe(false);
    expect(statuses[0].paidAmount).toBe(0);
    expect(service.summary().paidCount).toBe(0);
    expect(service.summary().pendingCount).toBe(1);

    // Registramos un gasto en noviembre con categoría 'Somos Internet'
    await expensesService.addExpense({
      date: '2026-11-04',
      person: 'Charlie',
      category: 'Somos Internet' as any,
      amount: 85_000,
      description: 'Pago mensual internet fibra',
    });

    // Ahora debe marcarse automáticamente con el chulo de pagado
    statuses = service.monthlyStatuses();
    expect(statuses.length).toBe(1);
    expect(statuses[0].isPaid).toBe(true);
    expect(statuses[0].paidAmount).toBe(85_000);
    expect(statuses[0].paidDate).toBe('2026-11-04');
    expect(service.summary().paidCount).toBe(1);
    expect(service.summary().pendingCount).toBe(0);
    expect(service.summary().progressPercentage).toBe(100);
  });

  it('keeps fixed expense pending for other months where it has not been paid', async () => {
    service.setYear(2026);
    service.setMonth(11);

    const fixed = await service.addFixedExpense({
      name: 'Administración',
      expectedAmount: 220_000,
      person: 'Compartido',
      dueDay: 10,
      status: 'activo',
    });

    // Pagamos en noviembre
    await expensesService.addExpense({
      date: '2026-11-05',
      person: 'Benny',
      category: 'Administración' as any,
      amount: 220_000,
      description: 'Pago administración nov',
    });

    expect(service.monthlyStatuses()[0].isPaid).toBe(true);

    // Si cambiamos a diciembre (mes 12), aún no se ha pagado en diciembre
    service.setMonth(12);
    expect(service.monthlyStatuses()[0].isPaid).toBe(false);
    expect(service.summary().paidCount).toBe(0);
    expect(service.summary().pendingCount).toBe(1);

    // Verifica el histórico anual
    const yearly = service.getYearlyHistoryForFixedExpense(fixed.id, 2026);
    expect(yearly[10].month).toBe(11);
    expect(yearly[10].isPaid).toBe(true);
    expect(yearly[11].month).toBe(12);
    expect(yearly[11].isPaid).toBe(false);
  });

  it('stores and updates dia_limite_mes and dias_anticipacion_alerta, calculating vencimiento in monthlyStatuses', async () => {
    service.setYear(2026);
    service.setMonth(11);

    const fixed = await service.addFixedExpense({
      name: 'Gimnasio',
      expectedAmount: 120_000,
      person: 'Charlie',
      dia_limite_mes: 20,
      dias_anticipacion_alerta: 5,
      status: 'activo',
    });

    expect(fixed.dia_limite_mes).toBe(20);
    expect(fixed.dias_anticipacion_alerta).toBe(5);
    expect(fixed.dueDay).toBe(20);

    const statuses = service.monthlyStatuses();
    expect(statuses.length).toBe(1);
    expect(statuses[0].vencimiento).toBeDefined();
    expect(statuses[0].vencimiento?.fechaLimiteCalculada).toBe('2026-11-20');

    // Actualizar con nuevos valores
    await service.updateFixedExpense(fixed.id, {
      name: 'Gimnasio Premium',
      expectedAmount: 150_000,
      person: 'Charlie',
      dia_limite_mes: 25,
      dias_anticipacion_alerta: 4,
      status: 'activo',
    });

    const updated = service.fixedExpenses().find((f) => f.id === fixed.id);
    expect(updated?.name).toBe('Gimnasio Premium');
    expect(updated?.dia_limite_mes).toBe(25);
    expect(updated?.dias_anticipacion_alerta).toBe(4);

    const updatedStatuses = service.monthlyStatuses();
    expect(updatedStatuses[0].vencimiento?.fechaLimiteCalculada).toBe('2026-11-25');
  });
});
