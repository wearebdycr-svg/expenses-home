import { Injectable, inject, signal } from '@angular/core';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';
import { SupabaseService } from './supabase.service';

export interface AppUserAccount {
  username: string;
  passwordHash: string;
  salt: string;
  name: string;
  created_at?: string;
}

export interface SecuritySession {
  token: string;
  username: string;
  name: string;
  lastActive: number;
  expiresAt: number;
}

export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos estilo Bancolombia
const SESSION_STORAGE_KEY = 'expenses_home_security_session_v2';
const USERS_STORAGE_KEY = 'expenses_home_security_users_v2';
const BIOMETRIC_ENROLLED_KEY = 'expenses_home_biometric_enrolled_v2';
const FAILED_ATTEMPTS_KEY = 'expenses_home_login_failed_v2';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000; // 30 segundos tras 5 intentos fallidos

// PIN legacy para retrocompatibilidad
const PIN_STORAGE_KEY = 'expenses_home_pin_hash';
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
  // Fallback simple para entornos sin subtle crypto
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

function generateSecureToken(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(24);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

@Injectable({
  providedIn: 'root',
})
export class AuthPinService {
  private readonly supabase = inject(SupabaseService);

  readonly isUnlocked = signal<boolean>(false);
  readonly isLockedOut = signal<boolean>(false);
  readonly lockoutRemainingSecs = signal<number>(0);
  readonly currentUser = signal<{ username: string; name: string } | null>(null);
  readonly sessionExpiresAt = signal<number>(0);
  readonly expiredNotice = signal<string | null>(null);
  readonly isBiometricAvailable = signal<boolean>(false);
  readonly isBiometricEnabled = signal<boolean>(true);
  readonly hasBiometricEnrolled = signal<boolean>(false);
  readonly biometryTypeName = signal<string>('Huella');
  readonly hasCustomPin = signal<boolean>(false);

  private lockoutIntervalId: any = null;
  private sessionCheckIntervalId: any = null;
  private lastActivityThrottle = 0;

  constructor() {
    this.seedDefaultUsers();
    this.checkInitialState();
    this.setupAutoLockListeners();
    this.setupActivityListeners();
    this.startSessionExpiryMonitor();
  }

  /**
   * Inicializa usuarios por defecto (Charlie, Benny, Admin) si no existen todavía.
   */
  private async seedDefaultUsers(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    try {
      const existing = localStorage.getItem(USERS_STORAGE_KEY);
      if (!existing) {
        const charlieSalt = generateSalt();
        const bennySalt = generateSalt();
        const adminSalt = generateSalt();

        const defaultUsers: AppUserAccount[] = [
          {
            username: 'charlie',
            passwordHash: await sha256(charlieSalt + 'charlie2026'),
            salt: charlieSalt,
            name: 'Charlie',
            created_at: new Date().toISOString(),
          },
          {
            username: 'benny',
            passwordHash: await sha256(bennySalt + 'benny2026'),
            salt: bennySalt,
            name: 'Benny',
            created_at: new Date().toISOString(),
          },
          {
            username: 'admin',
            passwordHash: await sha256(adminSalt + 'admin2026'),
            salt: adminSalt,
            name: 'Administrador',
            created_at: new Date().toISOString(),
          },
        ];
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaultUsers));
      }
    } catch {
      // Ignorar
    }
  }

  /**
   * Comprueba el estado inicial de la sesión.
   * Si hay un token válido y NO han pasado 10 minutos de inactividad, entra directo.
   */
  private checkInitialState(): void {
    if (typeof localStorage === 'undefined') {
      this.isUnlocked.set(true);
      return;
    }

    // Comprobar huella en el dispositivo
    this.checkBiometricAvailability().catch(() => {});
    const bioEnrolled = localStorage.getItem(BIOMETRIC_ENROLLED_KEY) === 'true';
    this.hasBiometricEnrolled.set(bioEnrolled);
    this.hasCustomPin.set(Boolean(localStorage.getItem(PIN_STORAGE_KEY)));

    // Revisar bloqueo por intentos fallidos
    this.checkLockoutStatus();

    // Revisar sesión activa (10 minutos TTL)
    try {
      const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionRaw) {
        const session: SecuritySession = JSON.parse(sessionRaw);
        const now = Date.now();
        if (session.expiresAt && now < session.expiresAt) {
          // Sesión aún válida dentro de los 10 minutos
          this.currentUser.set({ username: session.username, name: session.name });
          this.sessionExpiresAt.set(session.expiresAt);
          this.isUnlocked.set(true);
          return;
        } else {
          // Sesión expirada
          localStorage.removeItem(SESSION_STORAGE_KEY);
          this.expiredNotice.set('Tu sesión expiró por inactividad (10 minutos).');
        }
      }
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }

    this.isUnlocked.set(false);
  }

  /**
   * Monitor de inactividad que evalúa periódicamente si pasaron los 10 minutos.
   */
  private startSessionExpiryMonitor(): void {
    if (typeof window === 'undefined') return;
    this.sessionCheckIntervalId = setInterval(() => {
      if (this.isUnlocked()) {
        const expiresAt = this.sessionExpiresAt();
        if (expiresAt > 0 && Date.now() >= expiresAt) {
          this.handleSessionExpired('Tu sesión ha expirado por inactividad (10 minutos).');
        }
      }
    }, 5000);
  }

  /**
   * Escucha eventos de interacción del usuario para extender la ventana de 10 minutos.
   */
  private setupActivityListeners(): void {
    if (typeof window === 'undefined') return;
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    const onUserInteraction = () => {
      const now = Date.now();
      // Throttle: registrar actividad máximo una vez cada 10 segundos
      if (now - this.lastActivityThrottle > 10_000) {
        this.lastActivityThrottle = now;
        this.recordActivity();
      }
    };

    events.forEach((evt) => {
      window.addEventListener(evt, onUserInteraction, { passive: true });
    });
  }

  /**
   * Renueva el temporizador a +10 minutos cada vez que el usuario interactúa.
   */
  recordActivity(): void {
    if (!this.isUnlocked()) return;
    try {
      const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionRaw) {
        const session: SecuritySession = JSON.parse(sessionRaw);
        const now = Date.now();
        session.lastActive = now;
        session.expiresAt = now + INACTIVITY_TIMEOUT_MS;
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        this.sessionExpiresAt.set(session.expiresAt);
      }
    } catch {
      // Ignorar error
    }
  }

  /**
   * Configura listeners de ciclo de vida en la app móvil:
   * Si el usuario se va a otra app o minimiza, NO BLOQUEA.
   * Solo si pasan más de 10 minutos en segundo plano se cierra la sesión.
   */
  private setupAutoLockListeners(): void {
    if (typeof window === 'undefined') return;

    if (Capacitor.isNativePlatform()) {
      try {
        CapApp.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            // Pasó a segundo plano: actualizar marca de tiempo
            this.recordActivity();
          } else {
            // Regresó a primer plano: verificar si expiró la sesión
            const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
            if (sessionRaw) {
              const session: SecuritySession = JSON.parse(sessionRaw);
              if (Date.now() >= session.expiresAt) {
                this.handleSessionExpired('Tu sesión expiró por inactividad (10 minutos).');
              } else {
                // Sigue dentro de los 10 minutos: extender la sesión
                this.recordActivity();
              }
            } else {
              this.isUnlocked.set(false);
            }
          }
        });
      } catch {
        // Ignorar
      }
    }
  }

  private handleSessionExpired(reason: string): void {
    this.lock();
    this.expiredNotice.set(reason);
  }

  private checkLockoutStatus(): void {
    try {
      const failedDataStr = localStorage.getItem(FAILED_ATTEMPTS_KEY);
      if (!failedDataStr) return;

      const failedData = JSON.parse(failedDataStr);
      if (failedData.lockedUntil && Date.now() < failedData.lockedUntil) {
        this.triggerLockout(failedData.lockedUntil);
      } else if (failedData.lockedUntil && Date.now() >= failedData.lockedUntil) {
        localStorage.removeItem(FAILED_ATTEMPTS_KEY);
        this.isLockedOut.set(false);
        this.lockoutRemainingSecs.set(0);
      }
    } catch {
      // Ignorar
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
   * Inicio de Sesión con Usuario y Contraseña (con token seguro bancario).
   */
  async loginWithCredentials(
    rawUsername: string,
    rawPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isLockedOut()) {
      return {
        success: false,
        error: `Acceso bloqueado por seguridad. Espera ${this.lockoutRemainingSecs()} segundos.`,
      };
    }

    const username = rawUsername.trim().toLowerCase();
    const password = rawPassword;

    if (!username) {
      return { success: false, error: 'Ingresa tu nombre de usuario o correo.' };
    }
    if (!password || password.length < 4) {
      return { success: false, error: 'Ingresa una contraseña válida.' };
    }

    // 1. Buscar usuario local
    const users: AppUserAccount[] = this.getLocalUsers();
    let foundUser = users.find((u) => u.username === username);

    // Si la lista está vacía, re-sembrar y reintentar
    if (!foundUser && (username === 'charlie' || username === 'benny' || username === 'admin')) {
      await this.seedDefaultUsers();
      foundUser = this.getLocalUsers().find((u) => u.username === username);
    }

    if (!foundUser) {
      this.registerFailedAttempt();
      return {
        success: false,
        error: 'Usuario no encontrado. Si es tu primera vez, pulsa "Crear cuenta".',
      };
    }

    const computedHash = await sha256(foundUser.salt + password);
    if (computedHash !== foundUser.passwordHash) {
      this.registerFailedAttempt();
      return {
        success: false,
        error: 'Contraseña incorrecta. Verifica e intenta nuevamente.',
      };
    }

    // Éxito: crear sesión bancaria de 10 minutos
    this.createActiveSession(foundUser.username, foundUser.name);
    return { success: true };
  }

  /**
   * Registro de un nuevo usuario en la app (con contraseña segura y hash salt).
   */
  async registerUser(
    rawUsername: string,
    rawPassword: string,
    rawName?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const username = rawUsername.trim().toLowerCase();
    const password = rawPassword;
    const name = (rawName || rawUsername).trim();

    if (!username || username.length < 3) {
      return { success: false, error: 'El usuario debe tener al menos 3 caracteres.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    const users = this.getLocalUsers();
    if (users.some((u) => u.username === username)) {
      return { success: false, error: 'Este nombre de usuario ya está registrado.' };
    }

    const salt = generateSalt();
    const passwordHash = await sha256(salt + password);
    const newUser: AppUserAccount = {
      username,
      passwordHash,
      salt,
      name: name || username,
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

    // Intentar sincronizar en Supabase si la tabla app_users existe
    try {
      await this.supabase.client.from('app_users').insert([
        {
          username: newUser.username,
          password_hash: newUser.passwordHash,
          salt: newUser.salt,
          full_name: newUser.name,
        },
      ]);
    } catch {
      // Ignorar si la tabla aún no se ha creado en Supabase
    }

    // Iniciar sesión inmediatamente
    this.createActiveSession(newUser.username, newUser.name);
    return { success: true };
  }

  /**
   * Crea una sesión activa con token seguro y temporizador de 10 minutos.
   */
  private createActiveSession(username: string, name: string): void {
    const token = generateSecureToken();
    const now = Date.now();
    const expiresAt = now + INACTIVITY_TIMEOUT_MS;

    const session: SecuritySession = {
      token,
      username,
      name,
      lastActive: now,
      expiresAt,
    };

    localStorage.removeItem(FAILED_ATTEMPTS_KEY);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    // En celular, registrar que el usuario tiene acceso biométrico listo
    if (Capacitor.isNativePlatform() && this.isBiometricAvailable()) {
      localStorage.setItem(BIOMETRIC_ENROLLED_KEY, 'true');
      this.hasBiometricEnrolled.set(true);
    }

    this.isLockedOut.set(false);
    this.lockoutRemainingSecs.set(0);
    this.currentUser.set({ username, name });
    this.sessionExpiresAt.set(expiresAt);
    this.expiredNotice.set(null);
    this.isUnlocked.set(true);
  }

  private getLocalUsers(): AppUserAccount[] {
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
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
      // Ignorar
    }
  }

  /**
   * Desbloqueo directo con Huella en el celular (APK).
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

    try {
      await NativeBiometric.verifyIdentity({
        title: 'Expenses Home',
        subtitle: 'Acceso Seguro',
        description: `Usa tu ${this.biometryTypeName().toLowerCase()} para ingresar`,
        negativeButtonText: 'Usar Contraseña',
        maxAttempts: 3,
      });

      // Huella exitosa: crear nueva sesión de 10 minutos
      const lastUser = this.currentUser() || { username: 'charlie', name: 'Charlie' };
      this.createActiveSession(lastUser.username, lastUser.name);
      return { success: true };
    } catch (err: any) {
      const msg = err?.message || String(err || '');
      return { success: false, error: msg };
    }
  }

  /**
   * Retrocompatibilidad para PinLock si se requiere verificación de PIN numérico.
   */
  async unlock(pin: string, _rememberDevice = true): Promise<{ success: boolean; error?: string }> {
    if (this.isLockedOut()) {
      return {
        success: false,
        error: `Acceso bloqueado. Espera ${this.lockoutRemainingSecs()} segundos.`,
      };
    }

    const savedHash = localStorage.getItem(PIN_STORAGE_KEY);
    const salt = localStorage.getItem('expenses_home_pin_salt') || FIXED_DEFAULT_SALT;
    const isValid = !savedHash ? pin === DEFAULT_INITIAL_PIN : (await sha256(salt + pin)) === savedHash;

    if (isValid) {
      this.createActiveSession('usuario', 'Familia');
      return { success: true };
    } else {
      this.registerFailedAttempt();
      return { success: false, error: 'PIN incorrecto.' };
    }
  }

  async setCustomPin(newPin: string, currentPin?: string): Promise<{ success: boolean; error?: string }> {
    if (!newPin || newPin.length < 4) {
      return { success: false, error: 'El PIN debe tener al menos 4 dígitos.' };
    }
    if (currentPin) {
      const savedHash = localStorage.getItem(PIN_STORAGE_KEY);
      const salt = localStorage.getItem('expenses_home_pin_salt') || FIXED_DEFAULT_SALT;
      const isValid = !savedHash
        ? currentPin === DEFAULT_INITIAL_PIN
        : (await sha256(salt + currentPin)) === savedHash;
      if (!isValid) {
        return { success: false, error: 'El PIN actual es incorrecto.' };
      }
    }
    const salt = generateSalt();
    const hash = await sha256(salt + newPin);
    localStorage.setItem(PIN_STORAGE_KEY, hash);
    localStorage.setItem('expenses_home_pin_salt', salt);
    this.hasCustomPin.set(true);
    return { success: true };
  }

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
    } catch {
      this.isBiometricAvailable.set(false);
      return false;
    }
  }

  setBiometricEnabled(enabled: boolean): void {
    this.isBiometricEnabled.set(enabled);
  }

  /**
   * Cierra manualmente la sesión (bloqueo voluntario).
   */
  lock(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    this.sessionExpiresAt.set(0);
    this.isUnlocked.set(false);
  }

  /**
   * Cierra la sesión activa y elimina datos de usuario activo.
   */
  logout(): void {
    this.lock();
    this.currentUser.set(null);
  }
}
