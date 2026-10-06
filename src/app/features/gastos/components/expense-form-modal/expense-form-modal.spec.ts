import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { Expense } from '../../data/expense.model';
import { ExpenseFormModal } from './expense-form-modal';
import { DebtsService } from '../../../deudas/data/debts.service';
import { TcService } from '../../../tc-compartida/data/tc.service';
import { ExpensesService } from '../../data/expenses.service';

describe('ExpenseFormModal', () => {
  let fixture: ComponentFixture<ExpenseFormModal>;
  let component: ExpenseFormModal;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ExpenseFormModal] }).compileComponents();
    fixture = TestBed.createComponent(ExpenseFormModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('defaults to "Nuevo Gasto" with empty person and Mercado preselected', () => {
    expect(fixture.nativeElement.querySelector('.modal-title').textContent).toContain('Nuevo Gasto');
    expect(component['person']()).toBe('');
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

  it('blocks submit and shows errors if required fields are missing', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    // Missing person, description, amount
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(spy).not.toHaveBeenCalled();
    expect(component['hasErrors']()).toBe(true);
    expect(component['errors']()['person']).toBe('Debes seleccionar la persona');
    expect(component['errors']()['description']).toBe('La descripción es obligatoria');
    expect(component['errors']()['amount']).toBe('El monto debe ser mayor a 0');

    // Missing amount
    component['person'].set('Benny');
    component['description'].set('Test');
    component['amount'].set('');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits save with the valid payload', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    component['person'].set('Benny');
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

  it('registers shared TC expense directly in tc_expenses when person is Compartido', () => {
    const tcService = TestBed.inject(TcService);
    const tcSpy = vi.spyOn(tcService, 'addTcExpense');
    const cancelSpy = vi.fn();
    component.cancel.subscribe(cancelSpy);

    component['person'].set('Compartido');
    component['category'].set('TC-compartida');
    component['description'].set('Mercado compartido');
    component['amount'].set('80000');

    component['onSubmit']();

    expect(tcSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: 'tc-compartida',
        person: 'Compartido',
        amount: 80_000,
        description: 'Mercado compartido',
      }),
    );
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('registers shared TC expense directly in tc_expenses when person is Compartido even with standard category like Mercado', () => {
    const tcService = TestBed.inject(TcService);
    const tcSpy = vi.spyOn(tcService, 'addTcExpense');
    const cancelSpy = vi.fn();
    const saveSpy = vi.fn();
    component.cancel.subscribe(cancelSpy);
    component.save.subscribe(saveSpy);

    component['person'].set('Compartido');
    component['category'].set('Mercado');
    component['description'].set('Compra masa de maíz olimpica');
    component['amount'].set('18161');

    component['onSubmit']();

    expect(tcSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: 'tc-compartida',
        person: 'Compartido',
        category: 'Mercado',
        amount: 18_161,
        description: 'Compra masa de maíz olimpica',
      }),
    );
    expect(cancelSpy).toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('removes from expenses and adds to tc_expenses when editing an existing expense and setting person to Compartido', () => {
    const tcService = TestBed.inject(TcService);
    const expensesService = TestBed.inject(ExpensesService);
    const tcSpy = vi.spyOn(tcService, 'addTcExpense');
    const deleteSpy = vi.spyOn(expensesService, 'deleteExpense');
    const cancelSpy = vi.fn();
    component.cancel.subscribe(cancelSpy);

    fixture.componentRef.setInput('expense', {
      id: 'exp-123',
      date: '2026-10-05',
      person: 'Charlie',
      category: 'Mercado',
      description: 'Gasto anterior',
      amount: 50000,
    });
    fixture.detectChanges();

    component['person'].set('Compartido');
    component['category'].set('Mercado');
    component['description'].set('Ahora compartido');
    component['amount'].set('50000');

    component['onSubmit']();

    expect(tcSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: 'tc-compartida',
        person: 'Compartido',
        category: 'Mercado',
        amount: 50_000,
        description: 'Ahora compartido',
      }),
    );
    expect(deleteSpy).toHaveBeenCalledWith('exp-123');
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('emits normal save (abono that discounts debt) when person is Benny or Charlie for TC-compartida', () => {
    const saveSpy = vi.fn();
    component.save.subscribe(saveSpy);

    component['person'].set('Benny');
    component['category'].set('TC-compartida');
    component['description'].set('Pago cuota TC');
    component['amount'].set('250000');

    component['onSubmit']();

    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        person: 'Benny',
        category: 'TC-compartida',
        amount: 250_000,
        description: 'Pago cuota TC',
      }),
    );
  });

  it('triggers personal-tc-prompt for personal cards and handles Gasto vs Abono', () => {
    const tcService = TestBed.inject(TcService);
    const tcSpy = vi.spyOn(tcService, 'addTcExpense');
    const saveSpy = vi.fn();
    component.save.subscribe(saveSpy);

    component['person'].set('Charlie');
    component['category'].set('TC: TC Nu Charlie');
    component['description'].set('Pago o compra');
    component['amount'].set('120000');

    component['onSubmit']();

    expect(component['confirmationType']()).toBe('personal-tc-prompt');

    // Case 1: Cancel/Correct
    component['cancelConfirmation']();
    expect(component['confirmationType']()).toBe('none');
    expect(tcSpy).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();

    // Re-trigger
    component['onSubmit']();
    expect(component['confirmationType']()).toBe('personal-tc-prompt');

    // Case 2: Register as Gasto (consumo)
    component['confirmPersonalTcMovement']('expense');
    expect(tcSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: 'tc-nu-charlie',
        amount: 120_000,
      }),
    );
  });
});

