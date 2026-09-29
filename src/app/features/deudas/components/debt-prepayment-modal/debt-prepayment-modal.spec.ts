import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { Debt } from '../../data/debt.model';
import { DebtPrepaymentModal } from './debt-prepayment-modal';

describe('DebtPrepaymentModal', () => {
  let fixture: ComponentFixture<DebtPrepaymentModal>;
  let component: DebtPrepaymentModal;

  const mockDebts: Debt[] = [
    {
      id: 'debt-1',
      name: 'Hipoteca Apartamento',
      person: 'Compartido',
      originalAmount: 120_000_000,
      currentBalance: 64_500_000,
      monthlyPayment: 700_000,
      annualInterestRate: 8.5,
      startDate: '2026-07-01',
      color: '#3B82F6',
    },
    {
      id: 'debt-2',
      name: 'Tarjeta de Crédito',
      person: 'Benny',
      originalAmount: 5_000_000,
      currentBalance: 3_800_000,
      monthlyPayment: 500_000,
      annualInterestRate: 24.0,
      startDate: '2026-07-01',
      color: '#EF4444',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DebtPrepaymentModal] }).compileComponents();
    fixture = TestBed.createComponent(DebtPrepaymentModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('debts', mockDebts);
    fixture.detectChanges();
  });

  it('renders modal title and selects first debt by default', () => {
    expect(fixture.nativeElement.querySelector('.modal-title').textContent).toContain('Pago Adicional a Capital');
    expect(component['selectedDebtId']()).toBe('debt-1');
    expect(component['currentBalanceFormatted']()).toContain('64.500.000');
  });

  it('selects initialDebtId if provided', async () => {
    fixture.componentRef.setInput('initialDebtId', 'debt-2');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['selectedDebtId']()).toBe('debt-2');
    expect(component['currentBalanceFormatted']()).toContain('3.800.000');
  });

  it('blocks submit if amount is zero or negative', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    component['amount'].set('0');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits save with selected debt and valid amount', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    component['amount'].set('1000000');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

    expect(spy).toHaveBeenCalledWith({
      debtId: 'debt-1',
      amount: 1_000_000,
      date: component['date'](),
    });
  });

  it('emits cancel when Cancelar button is clicked', () => {
    const spy = vi.fn();
    component.cancel.subscribe(spy);

    const cancelBtn = fixture.nativeElement.querySelector('.btn-secondary');
    cancelBtn.click();
    expect(spy).toHaveBeenCalled();
  });
});
