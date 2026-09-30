import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastContainer } from './toast-container';
import { ToastService } from '../../../core/services/toast.service';

describe('ToastContainer', () => {
  let component: ToastContainer;
  let fixture: ComponentFixture<ToastContainer>;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastContainer],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastContainer);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  it('renders active toasts and triggers actions', () => {
    const actionSpy = vi.fn();
    toastService.success('Operación exitosa', { label: 'Deshacer', onClick: actionSpy });
    fixture.detectChanges();

    const toastElement = fixture.nativeElement.querySelector('.toast-item');
    expect(toastElement).toBeTruthy();
    expect(toastElement.textContent).toContain('Operación exitosa');

    const actionBtn = fixture.nativeElement.querySelector('.toast-action-btn');
    expect(actionBtn).toBeTruthy();
    expect(actionBtn.textContent).toContain('Deshacer');

    actionBtn.click();
    expect(actionSpy).toHaveBeenCalled();
  });

  it('dismisses toast on close button click', () => {
    toastService.info('Mensaje informativo');
    fixture.detectChanges();

    const closeBtn = fixture.nativeElement.querySelector('.toast-close-btn');
    closeBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.toast-item')).toBeNull();
  });
});
