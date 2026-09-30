import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { Expense } from '../../data/expense.model';
import { ExpenseFormModal } from './expense-form-modal';

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
    expect(component['amount']()).toBe('161657');
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
});
