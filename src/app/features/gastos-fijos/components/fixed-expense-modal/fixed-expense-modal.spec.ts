import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FixedExpenseModal } from './fixed-expense-modal';
import type { FixedExpense, FixedExpenseDraft } from '../../data/fixed-expense.model';

describe('FixedExpenseModal', () => {
  let fixture: ComponentFixture<FixedExpenseModal>;
  let component: FixedExpenseModal;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FixedExpenseModal],
    }).compileComponents();

    fixture = TestBed.createComponent(FixedExpenseModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders modal in creation mode with default values', () => {
    const title = fixture.nativeElement.querySelector('.modal-title');
    expect(title?.textContent).toContain('Nuevo Gasto Fijo Mensual');

    // Default alert anticipation should be 3
    const anticInput = fixture.nativeElement.querySelector('#fe-anticipacion') as HTMLInputElement;
    expect(anticInput.value).toBe('3');
  });

  it('validates required fields on submit without input', () => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const errors = fixture.nativeElement.querySelectorAll('.field-error');
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(fixture.nativeElement.textContent).toContain('El nombre del gasto fijo es obligatorio');
    expect(fixture.nativeElement.textContent).toContain('Ingresa un valor mayor a cero');
  });

  it('validates diaLimiteMes range (1..31)', () => {
    const nameInput = fixture.nativeElement.querySelector('#fe-name') as HTMLInputElement;
    nameInput.value = 'Seguro Hogar';
    nameInput.dispatchEvent(new Event('input'));

    const amountInput = fixture.nativeElement.querySelector('#fe-amount') as HTMLInputElement;
    amountInput.value = '150.000';
    amountInput.dispatchEvent(new Event('input'));

    const dayInput = fixture.nativeElement.querySelector('#fe-dia-limite') as HTMLInputElement;
    dayInput.value = '35';
    dayInput.dispatchEvent(new Event('input'));

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('El día debe estar entre 1 y 31');
  });

  it('validates diasAnticipacionAlerta >= 0', () => {
    const nameInput = fixture.nativeElement.querySelector('#fe-name') as HTMLInputElement;
    nameInput.value = 'Seguro Hogar';
    nameInput.dispatchEvent(new Event('input'));

    const amountInput = fixture.nativeElement.querySelector('#fe-amount') as HTMLInputElement;
    amountInput.value = '150.000';
    amountInput.dispatchEvent(new Event('input'));

    const anticInput = fixture.nativeElement.querySelector('#fe-anticipacion') as HTMLInputElement;
    anticInput.value = '-2';
    anticInput.dispatchEvent(new Event('input'));

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Los días de anticipación deben ser un entero mayor o igual a 0',
    );
  });

  it('emits save event with dia_limite_mes and dias_anticipacion_alerta when valid', () => {
    const saveSpy = vi.fn();
    component.save.subscribe(saveSpy);

    const nameInput = fixture.nativeElement.querySelector('#fe-name') as HTMLInputElement;
    nameInput.value = 'Plataforma Streaming';
    nameInput.dispatchEvent(new Event('input'));

    const amountInput = fixture.nativeElement.querySelector('#fe-amount') as HTMLInputElement;
    amountInput.value = '35.000';
    amountInput.dispatchEvent(new Event('input'));

    const dayInput = fixture.nativeElement.querySelector('#fe-dia-limite') as HTMLInputElement;
    dayInput.value = '18';
    dayInput.dispatchEvent(new Event('input'));

    const anticInput = fixture.nativeElement.querySelector('#fe-anticipacion') as HTMLInputElement;
    anticInput.value = '4';
    anticInput.dispatchEvent(new Event('input'));

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Plataforma Streaming',
        expectedAmount: 35_000,
        dia_limite_mes: 18,
        dueDay: 18,
        dias_anticipacion_alerta: 4,
        person: 'Compartido',
        status: 'activo',
      }),
    );
  });

  it('populates fields in edit mode from existing FixedExpense', () => {
    const existing: FixedExpense = {
      id: 'fe-edit-1',
      name: 'Internet Fibra',
      expectedAmount: 85_000,
      person: 'Charlie',
      dia_limite_mes: 10,
      dueDay: 10,
      dias_anticipacion_alerta: 5,
      status: 'activo',
      notes: 'Contrato 9876',
      createdAt: '2026-01-01T00:00:00Z',
    };

    fixture.componentRef.setInput('fixedExpense', existing);
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector('.modal-title');
    expect(title?.textContent).toContain('Editar Gasto Fijo');

    const nameInput = fixture.nativeElement.querySelector('#fe-name') as HTMLInputElement;
    expect(nameInput.value).toBe('Internet Fibra');

    const dayInput = fixture.nativeElement.querySelector('#fe-dia-limite') as HTMLInputElement;
    expect(dayInput.value).toBe('10');

    const anticInput = fixture.nativeElement.querySelector('#fe-anticipacion') as HTMLInputElement;
    expect(anticInput.value).toBe('5');
  });
});
