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

  it('defaults to "Nueva Deuda" with empty person', () => {
    expect(fixture.nativeElement.querySelector('.modal-title').textContent).toContain('Nueva Deuda');
    expect(component['person']()).toBe('');
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
    expect(component['originalAmount']()).toBe('120.000.000');
    expect(component['currentBalance']()).toBe('64.500.000');
    expect(component['monthlyPayment']()).toBe('700.000');
    expect(component['annualInterestRate']()).toBe('8.5');
  });

  it('blocks submit if required fields are missing or invalid', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    // Missing person
    component['name'].set('Préstamo');
    component['originalAmount'].set('1000000');
    component['currentBalance'].set('1000000');
    component['monthlyPayment'].set('100000');
    component['annualInterestRate'].set('12');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(spy).not.toHaveBeenCalled();
    expect(component['hasErrors']()).toBe(true);
    expect(component['errors']()['person']).toBe('Debes seleccionar la persona');

    // Missing name
    component['person'].set('Benny');
    component['name'].set('');
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

    component['person'].set('Benny');
    component['name'].set('Crédito Vehículo');
    component['originalAmount'].set('30000000');
    component['totalMonths'].set('36');
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
      totalMonths: 36,
    });
  });

  it('formats originalAmount and sets default currentBalance in create mode', () => {
    const originalInput = fixture.nativeElement.querySelector('input[placeholder*="10"]');
    originalInput.value = '12000000';
    originalInput.dispatchEvent(new Event('input'));

    const monthsInput = fixture.nativeElement.querySelector('input[placeholder*="12, 24"]');
    monthsInput.value = '12';
    monthsInput.dispatchEvent(new Event('input'));

    expect(component['totalMonths']()).toBe('12');
    expect(component['originalAmount']()).toBe('12.000.000');
    // currentBalance automatically defaults to originalAmount in create mode
    expect(component['currentBalance']()).toBe('12.000.000');
    // monthlyPayment is not auto-calculated; user must input it
    expect(component['monthlyPayment']()).toBe('');
  });

  it('allows manual entry of monthlyPayment with thousands formatting', () => {
    const paymentInput = fixture.nativeElement.querySelector('input[placeholder*="500.000"]');
    paymentInput.value = '2500000';
    paymentInput.dispatchEvent(new Event('input'));

    expect(component['monthlyPayment']()).toBe('2.500.000');
  });

  it('handles cancel button click', () => {
    const spy = vi.fn();
    component.cancel.subscribe(spy);
    const cancelBtn = fixture.nativeElement.querySelector('.btn-secondary');
    cancelBtn.click();
    expect(spy).toHaveBeenCalled();
  });
});
