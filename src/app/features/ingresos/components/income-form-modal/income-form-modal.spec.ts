import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { Income } from '../../data/income.model';
import { IncomeFormModal } from './income-form-modal';

describe('IncomeFormModal', () => {
  let fixture: ComponentFixture<IncomeFormModal>;
  let component: IncomeFormModal;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [IncomeFormModal] }).compileComponents();
    fixture = TestBed.createComponent(IncomeFormModal);
    component = fixture.componentInstance;
  });

  it('defaults to "Nuevo Ingreso" with today, Benny and Salario preselected', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.modal-title').textContent).toContain('Nuevo Ingreso');
    expect(component['person']()).toBe('Benny');
    expect(component['source']()).toBe('Salario');
    expect(component['description']()).toBe('');
    expect(component['amount']()).toBe('');
  });

  it('preloads "Editar Ingreso" with the given income', async () => {
    const existing: Income = {
      id: 'inc-100',
      date: '2026-07-22',
      person: 'Benny',
      source: 'Freelance',
      description: 'Proyecto diseño / consultoría',
      amount: 358_668,
    };
    fixture.componentRef.setInput('income', existing);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.modal-title').textContent).toContain('Editar Ingreso');
    expect(component['date']()).toBe('2026-07-22');
    expect(component['source']()).toBe('Freelance');
    expect(component['description']()).toBe('Proyecto diseño / consultoría');
    expect(component['amount']()).toBe('358668');
  });

  it('does not emit save when description is missing', () => {
    fixture.detectChanges();
    const spy = vi.fn();
    component.save.subscribe(spy);

    component['amount'].set('100000');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('does not emit save when amount is missing', () => {
    fixture.detectChanges();
    const spy = vi.fn();
    component.save.subscribe(spy);

    component['description'].set('Bono');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('strips non-numeric characters from the amount field', () => {
    fixture.detectChanges();
    const amountInput = fixture.nativeElement.querySelector('input[placeholder="3500000"]') as HTMLInputElement;
    amountInput.value = '35a0b0000';
    amountInput.dispatchEvent(new Event('input'));

    expect(component['amount']()).toBe('3500000');
  });

  it('emits a valid draft on submit', () => {
    fixture.detectChanges();
    const spy = vi.fn();
    component.save.subscribe(spy);

    component['description'].set('Proyecto diseño / consultoría');
    component['amount'].set('358668');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

    expect(spy).toHaveBeenCalledWith({
      date: component['date'](),
      person: 'Benny',
      source: 'Salario',
      description: 'Proyecto diseño / consultoría',
      amount: 358_668,
    });
  });

  it('emits cancel when the backdrop close button fires', () => {
    fixture.detectChanges();
    const spy = vi.fn();
    component.cancel.subscribe(spy);

    fixture.nativeElement.querySelector('.modal-close').click();

    expect(spy).toHaveBeenCalled();
  });
});
