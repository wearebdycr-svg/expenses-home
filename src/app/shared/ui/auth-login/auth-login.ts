import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthPinService } from '../../../core/services/auth-pin.service';
import { SupabaseAuthService } from '../../../core/services/supabase-auth.service';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-auth-login',
  standalone: true,
  imports: [CommonModule, FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-login.html',
  styleUrl: './auth-login.css',
})
export class AuthLogin {
  protected readonly authPinService = inject(AuthPinService);
  protected readonly supabaseAuth = inject(SupabaseAuthService);

  authenticated = output<void>();

  protected readonly email = signal<string>('');
  protected readonly password = signal<string>('');
  protected readonly isSignUpMode = signal<boolean>(false);
  protected readonly showPassword = signal<boolean>(false);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly errorMessage = signal<string>('');
  protected readonly successMessage = signal<string>('');

  protected toggleMode(): void {
    this.isSignUpMode.update((v) => !v);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  protected toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  protected async onSubmit(): Promise<void> {
    if (this.authPinService.isLockedOut()) {
      this.errorMessage.set(
        `Acceso bloqueado por seguridad. Espera ${this.authPinService.lockoutRemainingSecs()} segundos.`
      );
      return;
    }

    const rawEmail = this.email().trim().toLowerCase();
    const rawPass = this.password();

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      this.errorMessage.set('Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (!rawPass || rawPass.length < 6) {
      this.errorMessage.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      if (this.isSignUpMode()) {
        const { error, user } = await this.supabaseAuth.signUp(rawEmail, rawPass);
        if (error) {
          this.handleAuthError(error);
          return;
        }
        if (this.supabaseAuth.isAuthenticated()) {
          this.authenticated.emit();
        } else if (user) {
          this.successMessage.set(
            '¡Cuenta creada! Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.'
          );
          this.isSignUpMode.set(false);
        }
      } else {
        const { error } = await this.supabaseAuth.signInWithPassword(rawEmail, rawPass);
        if (error) {
          this.handleAuthError(error);
          return;
        }
        this.authenticated.emit();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.errorMessage.set('Error al conectar: ' + msg);
    } finally {
      this.isLoading.set(false);
    }
  }

  private handleAuthError(error: Error): void {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
      this.errorMessage.set('Correo o contraseña incorrectos.');
    } else if (msg.includes('email not confirmed')) {
      this.errorMessage.set('Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada.');
    } else if (msg.includes('already registered') || msg.includes('user already registered')) {
      this.errorMessage.set('Este correo ya está registrado. Intenta iniciar sesión.');
    } else if (msg.includes('rate limit') || msg.includes('too many requests')) {
      this.errorMessage.set('Demasiados intentos. Espera un momento antes de volver a intentar.');
    } else {
      this.errorMessage.set(error.message || 'No se pudo completar la autenticación.');
    }
  }
}
