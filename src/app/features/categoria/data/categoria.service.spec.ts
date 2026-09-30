import { TestBed } from '@angular/core/testing';
import { CategoriaService } from './categoria.service';
import { ExpensesService } from '../../gastos/data/expenses.service';

describe('CategoriaService', () => {
  let service: CategoriaService;
  let expensesService: ExpensesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CategoriaService);
    expensesService = TestBed.inject(ExpensesService);
  });

  it('initializes with default filters', () => {
    expect(service.year()).toBe(new Date().getFullYear());
    expect(service.month()).toBe('Todos');
    expect(service.day()).toBe('Todos');
    expect(service.person()).toBe('Todos');
  });

  it('aggregates expenses by category and calculates percentages correctly', () => {
    service.setYear(2026);
    service.setMonth('Todos');

    // Add mock expenses to expensesService
    expensesService['expenses'].set([
      {
        id: '1',
        date: '2026-07-05',
        person: 'Compartido',
        category: 'Hogar',
        description: 'Arriendo',
        amount: 1_800_000,
      },
      {
        id: '2',
        date: '2026-07-10',
        person: 'Benny',
        category: 'Mercado',
        description: 'Mercado',
        amount: 200_000,
      },
      {
        id: '3',
        date: '2026-07-15',
        person: 'Charlie',
        category: 'Mercado',
        description: 'Restaurante',
        amount: 100_000,
      },
    ]);

    expect(service.totalPeriod()).toBe(2_100_000);
    expect(service.categoriesCount()).toBe(2);

    const rows = service.categoryRows();
    expect(rows.length).toBe(2);

    // Sorted DESC by total: Hogar (1.8M) first, then Mercado (300k)
    expect(rows[0].category).toBe('Hogar');
    expect(rows[0].total).toBe(1_800_000);
    expect(rows[0].compartido).toBe(1_800_000);
    expect(rows[0].benny).toBe(0);
    expect(rows[0].percentage).toBeCloseTo((1_800_000 / 2_100_000) * 100, 1);
    expect(rows[0].transactionCount).toBe(1);

    expect(rows[1].category).toBe('Mercado');
    expect(rows[1].total).toBe(300_000);
    expect(rows[1].benny).toBe(200_000);
    expect(rows[1].charlie).toBe(100_000);
    expect(rows[1].compartido).toBe(0);
    expect(rows[1].transactionCount).toBe(2);
  });

  it('filters by month and person correctly', () => {
    service.setYear(2026);
    expensesService['expenses'].set([
      {
        id: '1',
        date: '2026-07-05',
        person: 'Compartido',
        category: 'Hogar',
        description: 'Arriendo',
        amount: 1_800_000,
      },
      {
        id: '2',
        date: '2026-08-10',
        person: 'Benny',
        category: 'Mercado',
        description: 'Mercado',
        amount: 200_000,
      },
    ]);

    service.setMonth(7);
    expect(service.totalPeriod()).toBe(1_800_000);
    expect(service.categoriesCount()).toBe(1);

    service.setMonth('Todos');
    service.setPerson('Benny');
    expect(service.totalPeriod()).toBe(200_000);
    expect(service.categoriesCount()).toBe(1);
    expect(service.categoryRows()[0].category).toBe('Mercado');
  });
});
