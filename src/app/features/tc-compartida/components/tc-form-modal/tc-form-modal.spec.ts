import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TcFormModal } from './tc-form-modal';

describe('TcFormModal', () => {
  let fixture: ComponentFixture<TcFormModal>;
  let component: TcFormModal;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TcFormModal],
    }).compileComponents();

    fixture = TestBed.createComponent(TcFormModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders modal in create mode by default with empty person', () => {
    expect((component as any).modalTitle()).toBe('Registrar Consumo con Tarjeta');
    expect((component as any).submitLabel()).toBe('Registrar consumo');
    expect((component as any).person()).toBe('');
  });

  it('emits cancel on cancel click', () => {
    const cancelSpy = vi.spyOn(component.cancel, 'emit');
    const cancelBtn = fixture.nativeElement.querySelector('.btn-secondary') as HTMLButtonElement;
    cancelBtn.click();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('emits save when valid data is submitted', () => {
    const saveSpy = vi.spyOn(component.save, 'emit');

    (component as any).description.set('Supermercado');
    (component as any).amount.set('150000');
    (component as any).person.set('Charlie');
    (component as any).category.set('Supermercado');
    (component as any).date.set('2026-07-20');

    (component as any).onSubmit();

    expect(saveSpy).toHaveBeenCalledWith({
      date: '2026-07-20',
      person: 'Charlie',
      category: 'Supermercado',
      description: 'Supermercado',
      amount: 150_000,
    });
  });

  it('does not emit save and sets errors when required fields are missing', () => {
    const saveSpy = vi.spyOn(component.save, 'emit');

    (component as any).person.set('');
    (component as any).description.set('');
    (component as any).amount.set('');
    (component as any).onSubmit();

    expect(saveSpy).not.toHaveBeenCalled();
    expect((component as any).hasErrors()).toBe(true);
    expect((component as any).errors()['person']).toBe('Debes seleccionar la persona');
    expect((component as any).errors()['description']).toBe('La descripción es obligatoria');
  });
});
