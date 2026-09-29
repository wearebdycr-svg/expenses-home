import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { Debt } from '../../data/debt.model';
import { DebtFormModal } from './debt-form-modal';

describe('DebtFormModal', () => {
  let fixture: ComponentFixture<DebtFormModal>;
  let component: DebtFormModal;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DebtFormModal] }).compileComponents();
    fixture = TestBed.createComponent(DebtFormModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('defaults to "Nueva Deuda" with Benny preselected', () => {
    expect(fixture.nativeElement.querySelector('.modal-title').textContent).toContain('Nueva Deuda');
    expect(component['person']()).toBe('Benny');
    expect(component['name']()).toBe('');
    expect(component['originalAmount']()).toBe('');
    expect(component['currentBalance']()).toBe('');
    expect(component['monthlyPayment']()).toBe('');
    expect(component['annualInterestRate']()).toBe('');
  });

  it('preloads "Editar Deuda" with existing debt data', async () => {
    const existing: Debt = {
      id: 'debt-1',
      name: 'Hipoteca Apartamento',
      person: 'Compartido',
      originalAmount: 120_000_000,
      currentBalance: 64_500_000,
      monthlyPayment: 700_000,
      annualInterestRate: 8.5,
      startDate: '2026-07-01',
      color: '#3B82F6',
    };
    fixture.componentRef.setInput('debt', existing);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.modal-title').textContent).toContain('Editar Deuda');
    expect(component['person']()).toBe('Compartido');
    expect(component['name']()).toBe('Hipoteca Apartamento');
    expect(component['originalAmount']()).toBe('120000000');
    expect(component['currentBalance']()).toBe('64500000');
    expect(component['monthlyPayment']()).toBe('700000');
    expect(component['annualInterestRate']()).toBe('8.5');
  });

  it('blocks submit if required fields are missing or invalid', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    // Missing name
    component['name'].set('');
    component['originalAmount'].set('1000000');
    component['currentBalance'].set('1000000');
    component['monthlyPayment'].set('100000');
    component['annualInterestRate'].set('12');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(spy).not.toHaveBeenCalled();

    // Zero balance
    component['name'].set('Préstamo');
    component['currentBalance'].set('0');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits save with the valid payload', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    component['name'].set('Crédito Vehículo');
    component['originalAmount'].set('30000000');
    component['currentBalance'].set('14200000');
    component['monthlyPayment'].set('450000');
    component['annualInterestRate'].set('10.2');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

    expect(spy).toHaveBeenCalledWith({
      name: 'Crédito Vehículo',
      person: 'Benny',
      startDate: component['startDate'](),
      originalAmount: 30_000_000,
      currentBalance: 14_200_000,
      monthlyPayment: 450_000,
      annualInterestRate: 10.2,
    });
  });

  it('handles cancel button click', () => {
    const spy = vi.fn();
    component.cancel.subscribe(spy);
    const cancelBtn = fixture.nativeElement.querySelector('.btn-secondary');
    cancelBtn.click();
    expect(spy).toHaveBeenCalled();
  });
});
