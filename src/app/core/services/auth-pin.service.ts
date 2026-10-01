import { Injectable, signal } from '@angular/core';

const PIN_STORAGE_KEY = 'expenses_home_pin_hash';
const PIN_SALT_KEY = 'expenses_home_pin_salt';
const SESSION_STORAGE_KEY = 'expenses_home_pin_session';
const FAILED_ATTEMPTS_KEY = 'expenses_home_pin_failed';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000; // 30 segundos de penalización tras 5 intentos fallidos
const REMEMBER_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

// PIN por defecto para primer acceso: 2026
const DEFAULT_INITIAL_PIN = '2026';
const FIXED_DEFAULT_SALT = 'expenses_home_family_salt_v1';

async function sha256(text: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple para entornos de prueba
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'fallback_' + Math.abs(hash).toString(16);
}

@Injectable({
  providedIn: 'root',
})
export class AuthPinService {
  readonly isUnlocked = signal<boolean>(false);
  readonly isLockedOut = signal<boolean>(false);
  readonly lockoutRemainingSecs = signal<number>(0);
  readonly hasCustomPin = signal<boolean>(false);

  private lockoutIntervalId: any = null;

  constructor() {
    this.checkInitialState();
  }

  private checkInitialState(): void {
    if (typeof localStorage === 'undefined') {
      this.isUnlocked.set(true);
      return;
    }

    // 1. Revisar si hay un PIN personalizado configurado
    const savedHash = localStorage.getItem(PIN_STORAGE_KEY);
    this.hasCustomPin.set(Boolean(savedHash));

    // 2. Revisar bloqueo por intentos fallidos
    this.checkLockoutStatus();

    // 3. Revisar si hay sesión activa válida (localStorage o sessionStorage)
    const sessionStr =
      localStorage.getItem(SESSION_STORAGE_KEY) ||
      (typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(SESSION_STORAGE_KEY)
        : null);

    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        if (session.unlocked && session.expiresAt && Date.now() < session.expiresAt) {
          this.isUnlocked.set(true);
          return;
        }
      } catch {
        // Sesión inválida
      }
    }

    this.isUnlocked.set(false);
  }

  private checkLockoutStatus(): void {
    try {
      const failedDataStr = localStorage.getItem(FAILED_ATTEMPTS_KEY);
      if (!failedDataStr) return;

      const failedData = JSON.parse(failedDataStr);
      if (failedData.lockedUntil && Date.now() < failedData.lockedUntil) {
        this.triggerLockout(failedData.lockedUntil);
      } else if (failedData.lockedUntil && Date.now() >= failedData.lockedUntil) {
        // Tiempo de penalización cumplido, limpiar
        localStorage.removeItem(FAILED_ATTEMPTS_KEY);
        this.isLockedOut.set(false);
        this.lockoutRemainingSecs.set(0);
      }
    } catch {
      // Ignorar error de parsing
    }
  }

  private triggerLockout(lockedUntil: number): void {
    this.isLockedOut.set(true);
    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      this.lockoutRemainingSecs.set(remaining);
      if (remaining <= 0) {
        clearInterval(this.lockoutIntervalId);
        this.isLockedOut.set(false);
        localStorage.removeItem(FAILED_ATTEMPTS_KEY);
      }
    };

    updateRemaining();
    if (this.lockoutIntervalId) clearInterval(this.lockoutIntervalId);
    this.lockoutIntervalId = setInterval(updateRemaining, 1000);
  }

  /**
   * Intenta desbloquear la aplicación con el PIN ingresado.
   */
  async unlock(
    pin: string,
    rememberDevice = true,
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isLockedOut()) {
      return {
        success: false,
        error: `Acceso bloqueado. Espera ${this.lockoutRemainingSecs()} segundos.`,
      };
    }

    if (!pin || pin.length < 4) {
      return { success: false, error: 'El PIN debe tener al menos 4 dígitos.' };
    }

    const isValid = await this.verifyPin(pin);

    if (isValid) {
      // Éxito: limpiar intentos fallidos
      localStorage.removeItem(FAILED_ATTEMPTS_KEY);
      this.isLockedOut.set(false);
      this.lockoutRemainingSecs.set(0);

      // Guardar sesión
      const expiresAt = rememberDevice
        ? Date.now() + REMEMBER_DAYS_MS
        : Date.now() + 12 * 60 * 60 * 1000; // 12 horas

      const sessionData = JSON.stringify({ unlocked: true, expiresAt });

      if (rememberDevice) {
        localStorage.setItem(SESSION_STORAGE_KEY, sessionData);
      } else if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_STORAGE_KEY, sessionData);
      }

      this.isUnlocked.set(true);
      return { success: true };
    } else {
      // Fallo: registrar intento
      this.registerFailedAttempt();
      return { success: false, error: 'PIN incorrecto. Verifica e intenta de nuevo.' };
    }
  }

  private registerFailedAttempt(): void {
    try {
      const dataStr = localStorage.getItem(FAILED_ATTEMPTS_KEY);
      let count = 1;
      if (dataStr) {
        const data = JSON.parse(dataStr);
        count = (data.count || 0) + 1;
      }

      if (count >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = Date.now() + LOCKOUT_MS;
        localStorage.setItem(
          FAILED_ATTEMPTS_KEY,
          JSON.stringify({ count, lockedUntil }),
        );
        this.triggerLockout(lockedUntil);
      } else {
        localStorage.setItem(FAILED_ATTEMPTS_KEY, JSON.stringify({ count }));
      }
    } catch {
      // Ignorar error de storage
    }
  }

  private async verifyPin(pin: string): Promise<boolean> {
    const savedHash = localStorage.getItem(PIN_STORAGE_KEY);
    const salt = localStorage.getItem(PIN_SALT_KEY) || FIXED_DEFAULT_SALT;

    if (!savedHash) {
      // Usar PIN por defecto inicial
      return pin === DEFAULT_INITIAL_PIN;
    }

    const computedHash = await sha256(salt + pin);
    return computedHash === savedHash;
  }

  /**
   * Configura o cambia el PIN de seguridad.
   */
  async setCustomPin(
    newPin: string,
    currentPin?: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!newPin || newPin.length < 4 || newPin.length > 6) {
      return { success: false, error: 'El nuevo PIN debe tener entre 4 y 6 dígitos.' };
    }

    // Si ya existe un PIN, validar el actual
    const savedHash = localStorage.getItem(PIN_STORAGE_KEY);
    if (savedHash && currentPin) {
      const isCurrentValid = await this.verifyPin(currentPin);
      if (!isCurrentValid) {
        return { success: false, error: 'El PIN actual ingresado no es correcto.' };
      }
    }

    const salt = Math.random().toString(36).substring(2, 15);
    const newHash = await sha256(salt + newPin);

    localStorage.setItem(PIN_STORAGE_KEY, newHash);
    localStorage.setItem(PIN_SALT_KEY, salt);
    this.hasCustomPin.set(true);

    return { success: true };
  }

  /**
   * Bloquea manualmente la aplicación cerrando la sesión.
   */
  lock(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    this.isUnlocked.set(false);
  }
}
