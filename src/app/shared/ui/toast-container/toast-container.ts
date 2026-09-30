import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService, type Toast } from '../../../core/services/toast.service';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-toast-container',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.css',
})
export class ToastContainer {
  protected readonly toastService = inject(ToastService);
  protected readonly toasts = this.toastService.toasts;

  protected onDismiss(id: string): void {
    this.toastService.dismiss(id);
  }

  protected onActionClick(toast: Toast): void {
    if (toast.action) {
      toast.action.onClick();
      this.toastService.dismiss(toast.id);
    }
  }

  protected getIconName(type: Toast['type']): 'check-circle' | 'alert-circle' | 'alert-circle' | 'alert-circle' {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'error':
      case 'warning':
      case 'info':
      default:
        return 'alert-circle';
    }
  }
}
