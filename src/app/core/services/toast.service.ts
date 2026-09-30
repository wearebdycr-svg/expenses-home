import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number; // default 3500ms
  action?: ToastAction;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  show(
    message: string,
    options?: {
      type?: ToastType;
      duration?: number;
      action?: ToastAction;
    },
  ): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const toast: Toast = {
      id,
      message,
      type: options?.type ?? 'success',
      duration: options?.duration ?? 3500,
      action: options?.action,
    };

    this.toasts.update((current) => [...current, toast]);

    if (toast.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, toast.duration);
    }

    return id;
  }

  success(message: string, action?: ToastAction): string {
    return this.show(message, { type: 'success', action });
  }

  error(message: string, action?: ToastAction): string {
    return this.show(message, { type: 'error', action, duration: 4500 });
  }

  info(message: string, action?: ToastAction): string {
    return this.show(message, { type: 'info', action });
  }

  warning(message: string, action?: ToastAction): string {
    return this.show(message, { type: 'warning', action });
  }

  dismiss(id: string): void {
    this.toasts.update((current) => current.filter((t) => t.id !== id));
  }
}
