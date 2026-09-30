import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('adds and dismisses a toast', () => {
    const id = service.success('Test message');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('Test message');
    expect(service.toasts()[0].type).toBe('success');

    service.dismiss(id);
    expect(service.toasts().length).toBe(0);
  });

  it('supports action callback', () => {
    const spy = vi.fn();
    service.success('Item deleted', { label: 'Deshacer', onClick: spy });

    const toast = service.toasts()[0];
    expect(toast.action?.label).toBe('Deshacer');
    toast.action?.onClick();
    expect(spy).toHaveBeenCalled();
  });
});
