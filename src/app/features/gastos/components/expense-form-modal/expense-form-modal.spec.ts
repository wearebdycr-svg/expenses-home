import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { Expense } from '../../data/expense.model';
import { ExpenseFormModal } from './expense-form-modal';
import { DebtsService } from '../../../deudas/data/debts.service';

describe('ExpenseFormModal', () => {
  let fixture: ComponentFixture<ExpenseFormModal>;
  let component: ExpenseFormModal;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ExpenseFormModal] }).compileComponents();
    fixture = TestBed.createComponent(ExpenseFormModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('defaults to "Nuevo Gasto" with Benny and Mercado preselected', () => {
    expect(fixture.nativeElement.querySelector('.modal-title').textContent).toContain('Nuevo Gasto');
    expect(component['person']()).toBe('Benny');
    expect(component['category']()).toBe('Mercado');
    expect(component['description']()).toBe('');
    expect(component['amount']()).toBe('');
  });

  it('preloads "Editar Gasto" with existing expense data', async () => {
    const existing: Expense = {
      id: 'exp-100',
      date: '2026-07-28',
      person: 'Compartido',
      category: 'Mercado',
      description: 'Supermercado',
      amount: 161_657,
    };
    fixture.componentRef.setInput('expense', existing);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.modal-title').textContent).toContain('Editar Gasto');
    expect(component['date']()).toBe('2026-07-28');
    expect(component['person']()).toBe('Compartido');
    expect(component['category']()).toBe('Mercado');
    expect(component['description']()).toBe('Supermercado');
    expect(component['amount']()).toBe('161.657');
  });

  it('blocks submit if required fields are missing', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    component['description'].set('');
    component['amount'].set('100000');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(spy).not.toHaveBeenCalled();

    component['description'].set('Test');
    component['amount'].set('');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits save with the valid payload', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    component['description'].set('Supermercado');
    component['amount'].set('161657');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

    expect(spy).toHaveBeenCalledWith({
      date: component['date'](),
      person: 'Benny',
      category: 'Mercado',
      description: 'Supermercado',
      amount: 161_657,
    });
  });

  it('includes active debts dynamically in category options and detects overdraft', () => {
    const debtsService = TestBed.inject(DebtsService);
    debtsService.debts.set([
      {
        id: 'debt-test',
        name: 'Préstamo Auto',
        person: 'Benny',
        startDate: '2026-09-01',
        originalAmount: 10_000_000,
        currentBalance: 5_000_000,
        monthlyPayment: 500_000,
        annualInterestRate: 10,
        color: '#3b82f6',
        status: 'activa',
      },
    ]);

    const options = component['categoryOptions']();
    const debtOption = options.find((o) => o.value === 'Préstamo Auto');
    expect(debtOption).toBeDefined();
    expect(debtOption?.label).toBe('Deuda: Préstamo Auto');

    // Select the debt
    component['category'].set('Préstamo Auto');
    expect(component['selectedDebt']()?.name).toBe('Préstamo Auto');

    // Amount below balance: no overdraft
    component['amount'].set('3000000');
    expect(component['isOverdraft']()).toBe(false);

    // Amount above balance: overdraft detected
    component['amount'].set('6000000');
    expect(component['isOverdraft']()).toBe(true);
  });
});
