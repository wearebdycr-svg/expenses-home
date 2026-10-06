import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  private readonly authService = inject(SupabaseAuthService);

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
    const rawEmail = this.email().trim();
    const rawPassword = this.password();

    if (!rawEmail || !rawEmail.includes('@')) {
      this.errorMessage.set('Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (!rawPassword || rawPassword.length < 6) {
      this.errorMessage.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      if (this.isSignUpMode()) {
        const { error, user } = await this.authService.signUp(rawEmail, rawPassword);
        if (error) {
          this.handleAuthError(error);
        } else if (user && !this.authService.isAuthenticated()) {
          this.successMessage.set(
            '¡Cuenta creada! Si tu proyecto requiere confirmación por email, revisa tu bandeja de entrada para verificar tu cuenta e iniciar sesión.'
          );
        } else {
          this.authenticated.emit();
        }
      } else {
        const { error } = await this.authService.signInWithPassword(rawEmail, rawPassword);
        if (error) {
          this.handleAuthError(error);
        } else {
          this.authenticated.emit();
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.errorMessage.set('Error inesperado de conexión: ' + (message || 'intenta de nuevo.'));
    } finally {
      this.isLoading.set(false);
    }
  }

  private handleAuthError(error: Error): void {
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
      this.errorMessage.set('Credenciales incorrectas. Verifica el correo y la contraseña.');
    } else if (msg.includes('user already registered') || msg.includes('already exists')) {
      this.errorMessage.set('Este correo ya está registrado. Por favor selecciona "Iniciar Sesión".');
    } else if (msg.includes('email not confirmed')) {
      this.errorMessage.set('El correo aún no ha sido confirmado. Revisa tu bandeja de entrada o confirma el usuario en Supabase.');
    } else if (msg.includes('network') || msg.includes('failed to fetch')) {
      this.errorMessage.set('Error de red. Verifica tu conexión a internet.');
    } else {
      this.errorMessage.set(error.message);
    }
  }
}
