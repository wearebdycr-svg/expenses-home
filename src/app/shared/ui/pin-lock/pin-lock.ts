import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthPinService } from '../../../core/services/auth-pin.service';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-pin-lock',
  standalone: true,
  imports: [CommonModule, FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pin-lock.html',
  styleUrl: './pin-lock.css',
})
export class PinLock {
  protected readonly authPinService = inject(AuthPinService);

  unlocked = output<void>();

  protected readonly pin = signal<string>('');
  protected readonly rememberDevice = signal<boolean>(true);
  protected readonly errorMessage = signal<string>('');
  protected readonly isShaking = signal<boolean>(false);
  protected readonly isSuccess = signal<boolean>(false);
  protected readonly isSubmitting = signal<boolean>(false);

  // Modal para cambiar PIN
  protected readonly showChangeModal = signal<boolean>(false);
  protected readonly changeCurrentPin = signal<string>('');
  protected readonly changeNewPin = signal<string>('');
  protected readonly changeConfirmPin = signal<string>('');
  protected readonly changeError = signal<string>('');
  protected readonly changeSuccess = signal<string>('');

  @HostListener('window:keydown', ['$event'])
  handleKeyboardInput(event: KeyboardEvent): void {
    if (this.showChangeModal()) return;

    if (event.key >= '0' && event.key <= '9') {
      event.preventDefault();
      this.appendDigit(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.deleteDigit();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.submit();
    }
  }

  protected appendDigit(digit: string): void {
    if (this.isSubmitting() || this.authPinService.isLockedOut()) return;
    if (this.pin().length >= 6) return;

    this.errorMessage.set('');
    const newPin = this.pin() + digit;
    this.pin.set(newPin);

    // Si alcanza 4 dígitos, intentar desbloquear automáticamente
    if (newPin.length === 4) {
      this.submit();
    }
  }

  protected deleteDigit(): void {
    if (this.isSubmitting()) return;
    const current = this.pin();
    if (current.length > 0) {
      this.pin.set(current.slice(0, -1));
      this.errorMessage.set('');
    }
  }

  protected clearPin(): void {
    if (this.isSubmitting()) return;
    this.pin.set('');
    this.errorMessage.set('');
  }

  protected async submit(): Promise<void> {
    if (this.isSubmitting() || this.authPinService.isLockedOut()) return;
    const pinVal = this.pin();
    if (pinVal.length < 4) {
      this.errorMessage.set('Ingresa un PIN de al menos 4 dígitos.');
      this.triggerShake();
      return;
    }

    this.isSubmitting.set(true);
    const result = await this.authPinService.unlock(pinVal, this.rememberDevice());
    this.isSubmitting.set(false);

    if (result.success) {
      this.isSuccess.set(true);
      this.unlocked.emit();
    } else {
      this.errorMessage.set(result.error || 'PIN incorrecto.');
      this.triggerShake();
      this.pin.set('');
    }
  }

  private triggerShake(): void {
    this.isShaking.set(true);
    setTimeout(() => {
      this.isShaking.set(false);
    }, 450);
  }

  // Métodos para cambiar PIN
  protected openChangeModal(): void {
    this.changeCurrentPin.set('');
    this.changeNewPin.set('');
    this.changeConfirmPin.set('');
    this.changeError.set('');
    this.changeSuccess.set('');
    this.showChangeModal.set(true);
  }

  protected closeChangeModal(): void {
    this.showChangeModal.set(false);
  }

  protected async submitChangePin(): Promise<void> {
    const current = this.changeCurrentPin().trim();
    const next = this.changeNewPin().trim();
    const confirm = this.changeConfirmPin().trim();

    this.changeError.set('');
    this.changeSuccess.set('');

    if (next.length < 4 || next.length > 6) {
      this.changeError.set('El nuevo PIN debe tener entre 4 y 6 dígitos.');
      return;
    }

    if (next !== confirm) {
      this.changeError.set('La confirmación no coincide con el nuevo PIN.');
      return;
    }

    const res = await this.authPinService.setCustomPin(next, current);
    if (res.success) {
      this.changeSuccess.set('¡PIN actualizado con éxito! Ya puedes usarlo.');
      setTimeout(() => {
        this.closeChangeModal();
        this.clearPin();
      }, 1200);
    } else {
      this.changeError.set(res.error || 'No se pudo actualizar el PIN.');
    }
  }
}
