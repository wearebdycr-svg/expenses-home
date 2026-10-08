import { Injectable, signal } from '@angular/core';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';

const PIN_STORAGE_KEY = 'expenses_home_pin_hash';
const PIN_SALT_KEY = 'expenses_home_pin_salt';
const SESSION_STORAGE_KEY = 'expenses_home_pin_session';
const FAILED_ATTEMPTS_KEY = 'expenses_home_pin_failed';
const BIOMETRIC_ENABLED_KEY = 'expenses_home_biometric_enabled';
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
  throw new Error('Web Cryptography API (crypto.subtle) is required for secure authentication');
}

@Injectable({
  providedIn: 'root',
})
export class AuthPinService {
  readonly isUnlocked = signal<boolean>(false);
  readonly isLockedOut = signal<boolean>(false);
  readonly lockoutRemainingSecs = signal<number>(0);
  readonly hasCustomPin = signal<boolean>(false);
  readonly isBiometricAvailable = signal<boolean>(false);
  readonly isBiometricEnabled = signal<boolean>(true);
  readonly biometryTypeName = signal<string>('Huella');

  private lockoutIntervalId: any = null;

  constructor() {
    this.checkInitialState();
    this.setupAutoLockListeners();
  }

  private setupAutoLockListeners(): void {
    if (typeof window === 'undefined') return;

    // Solo en entorno nativo móvil (Android/iOS) escuchamos el ciclo de vida para auto-bloqueo al minimizar
    if (Capacitor.isNativePlatform()) {
      try {
        CapApp.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            this.lock();
          }
        });
      } catch {
        // Ignorar
      }

      document.addEventListener('pause', () => {
        this.lock();
      });
    }
  }

  private checkInitialState(): void {
    if (typeof localStorage === 'undefined') {
      this.isUnlocked.set(true);
      return;
    }

    // 1. Revisar si hay un PIN personalizado configurado
    const savedHash = localStorage.getItem(PIN_STORAGE_KEY);
    this.hasCustomPin.set(Boolean(savedHash));

    // Revisar preferencia biométrica guardada
    const bioPref = localStorage.getItem(BIOMETRIC_ENABLED_KEY);
    this.isBiometricEnabled.set(bioPref !== 'false');

    // Comprobar disponibilidad biométrica en el dispositivo
    this.checkBiometricAvailability().catch(() => {});

    // 2. Revisar bloqueo por intentos fallidos
    this.checkLockoutStatus();

    // 3. En entorno nativo móvil: SIEMPRE inicia bloqueada pidiendo la clave
    if (Capacitor.isNativePlatform()) {
      this.isUnlocked.set(false);
    } else {
      // En entorno Web: Mantiene la sesión activa si ya fue autenticada en esta sesión o recordada
      try {
        const isSessionUnlocked = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';
        const rememberExpiry = localStorage.getItem(SESSION_STORAGE_KEY);
        const isRemembered = rememberExpiry && Number(rememberExpiry) > Date.now();
        this.isUnlocked.set(Boolean(isSessionUnlocked || isRemembered));
      } catch {
        this.isUnlocked.set(false);
      }
    }
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

      // Si estamos en entorno web, persistir la sesión para que refrescar la página no pida la clave
      if (!Capacitor.isNativePlatform()) {
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
          }
          if (rememberDevice && typeof localStorage !== 'undefined') {
            localStorage.setItem(SESSION_STORAGE_KEY, String(Date.now() + REMEMBER_DAYS_MS));
          }
        } catch {
          // Ignorar error de storage
        }
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

    const randomBytes = new Uint8Array(16);
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(randomBytes);
    } else {
      throw new Error('Web Cryptography API (crypto.getRandomValues) is required for secure salt generation');
    }
    const salt = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
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

  /**
   * Comprueba si el dispositivo cuenta con sensor biométrico (huella o rostro) enrolado y disponible.
   */
  async checkBiometricAvailability(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      this.isBiometricAvailable.set(false);
      return false;
    }

    try {
      const result = await NativeBiometric.isAvailable();
      const available = Boolean(result.isAvailable);
      this.isBiometricAvailable.set(available);

      if (available) {
        if (
          result.biometryType === BiometryType.FACE_ID ||
          result.biometryType === BiometryType.FACE_AUTHENTICATION
        ) {
          this.biometryTypeName.set('Rostro');
        } else {
          this.biometryTypeName.set('Huella');
        }
      }
      return available;
    } catch (e) {
      console.warn('[Biometric] Verificación biométrica no disponible:', e);
      this.isBiometricAvailable.set(false);
      return false;
    }
  }

  /**
   * Habilita o deshabilita el uso de biometría según preferencia del usuario.
   */
  setBiometricEnabled(enabled: boolean): void {
    this.isBiometricEnabled.set(enabled);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, String(enabled));
    }
  }

  /**
   * Desbloquea la aplicación utilizando el sensor biométrico nativo (Huella o Face).
   */
  async unlockWithBiometric(): Promise<{ success: boolean; error?: string }> {
    if (this.isLockedOut()) {
      return {
        success: false,
        error: `Acceso bloqueado. Espera ${this.lockoutRemainingSecs()} segundos.`,
      };
    }

    if (!Capacitor.isNativePlatform()) {
      return { success: false, error: 'Biometría solo disponible en la app móvil.' };
    }

    if (!this.isBiometricEnabled()) {
      return { success: false, error: 'Biometría deshabilitada en la configuración.' };
    }

    try {
      await NativeBiometric.verifyIdentity({
        title: 'Finanzas Hogar',
        subtitle: 'Desbloqueo de Seguridad',
        description: `Usa tu ${this.biometryTypeName().toLowerCase()} para acceder a tus cuentas`,
        negativeButtonText: 'Usar PIN',
        maxAttempts: 3,
      });

      // Éxito biométrico: limpiar penalizaciones e ingresar
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(FAILED_ATTEMPTS_KEY);
      }
      this.isLockedOut.set(false);
      this.lockoutRemainingSecs.set(0);
      this.isUnlocked.set(true);

      return { success: true };
    } catch (err: any) {
      const msg = err?.message || String(err || '');
      console.log('[Biometric] Verificación biométrica no completada:', msg);
      return {
        success: false,
        error: msg,
      };
    }
  }
}
