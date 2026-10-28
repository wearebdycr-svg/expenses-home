import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthPinService } from '../../../core/services/auth-pin.service';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-auth-login',
  standalone: true,
  imports: [CommonModule, FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-login.html',
  styleUrl: './auth-login.css',
})
export class AuthLogin implements OnInit {
  protected readonly authPinService = inject(AuthPinService);

  authenticated = output<void>();

  protected readonly username = signal<string>('');
  protected readonly password = signal<string>('');
  protected readonly fullName = signal<string>('');
  protected readonly isSignUpMode = signal<boolean>(false);
  protected readonly showPassword = signal<boolean>(false);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly errorMessage = signal<string>('');
  protected readonly successMessage = signal<string>('');

  async ngOnInit(): Promise<void> {
    await this.authPinService.checkBiometricAvailability();
    // En móvil, si la huella está enrolada y no hay bloqueo, ofrecer intento suave
    if (
      this.authPinService.isBiometricAvailable() &&
      this.authPinService.hasBiometricEnrolled() &&
      !this.authPinService.isLockedOut()
    ) {
      setTimeout(() => {
        this.onBiometricLogin(true);
      }, 400);
    }
  }

  protected toggleMode(): void {
    this.isSignUpMode.update((v) => !v);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  protected toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  protected fillQuickAccount(user: string, pass: string): void {
    this.username.set(user);
    this.password.set(pass);
    this.errorMessage.set('');
  }

  protected async onBiometricLogin(isAuto = false): Promise<void> {
    if (this.isLoading() || this.authPinService.isLockedOut()) return;

    this.errorMessage.set('');
    const res = await this.authPinService.unlockWithBiometric();
    if (res.success) {
      this.authenticated.emit();
    } else if (!isAuto && res.error) {
      const err = res.error.toLowerCase();
      const isCancellation =
        err.includes('cancel') ||
        err.includes('negative') ||
        err.includes('user_cancel') ||
        err.includes('dismiss');
      if (!isCancellation) {
        this.errorMessage.set('Huella no reconocida. Ingresa tu usuario y contraseña.');
      }
    }
  }

  protected async onSubmit(): Promise<void> {
    if (this.authPinService.isLockedOut()) {
      this.errorMessage.set(
        `Acceso bloqueado por seguridad. Espera ${this.authPinService.lockoutRemainingSecs()} segundos.`
      );
      return;
    }

    const rawUser = this.username().trim();
    const rawPass = this.password();

    if (!rawUser) {
      this.errorMessage.set('Por favor ingresa tu usuario o correo.');
      return;
    }

    if (!rawPass || rawPass.length < 4) {
      this.errorMessage.set('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      if (this.isSignUpMode()) {
        const res = await this.authPinService.registerUser(
          rawUser,
          rawPass,
          this.fullName().trim() || rawUser
        );
        if (res.success) {
          this.authenticated.emit();
        } else {
          this.errorMessage.set(res.error || 'No se pudo registrar el usuario.');
        }
      } else {
        const res = await this.authPinService.loginWithCredentials(rawUser, rawPass);
        if (res.success) {
          this.authenticated.emit();
        } else {
          this.errorMessage.set(res.error || 'Credenciales incorrectas.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.errorMessage.set('Error al conectar: ' + msg);
    } finally {
      this.isLoading.set(false);
    }
  }
}
