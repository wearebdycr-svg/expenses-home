import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ExpensesService } from '../../data/expenses.service';
import { ExpenseTable } from './expense-table';

describe('ExpenseTable', () => {
  let fixture: ComponentFixture<ExpenseTable>;
  let component: ExpenseTable;
  let service: ExpensesService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ExpenseTable] }).compileComponents();
    fixture = TestBed.createComponent(ExpenseTable);
    component = fixture.componentInstance;
    service = TestBed.inject(ExpensesService);
    fixture.detectChanges();
  });

  it('shows the empty-state message when there are no expenses', () => {
    const empty = fixture.nativeElement.querySelector('.empty-state');
    expect(empty?.textContent).toContain('No hay gastos registrados para el período seleccionado.');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('renders rows with count when expenses exist', () => {
    service.addExpense({
      date: '2026-07-28',
      person: 'Compartido',
      category: 'Alimentación',
      description: 'Supermercado',
      amount: 161_657,
    });
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(fixture.nativeElement.querySelector('.table-count').textContent).toContain('1 registros');
  });

  it('emits edit with the clicked expense', () => {
    service.addExpense({
      date: '2026-07-28',
      person: 'Compartido',
      category: 'Alimentación',
      description: 'Supermercado',
      amount: 161_657,
    });
    fixture.detectChanges();

    const spy = vi.fn();
    component.edit.subscribe(spy);

    fixture.nativeElement.querySelector('.icon-btn--edit').click();
    expect(spy).toHaveBeenCalledWith(service.filteredExpenses()[0]);
  });

  it('deletes the expense when user confirms', () => {
    service.addExpense({
      date: '2026-07-28',
      person: 'Compartido',
      category: 'Alimentación',
      description: 'Supermercado',
      amount: 161_657,
    });
    fixture.detectChanges();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.nativeElement.querySelector('.icon-btn--delete').click();
    expect(service.filteredExpenses().length).toBe(0);
  });
});
