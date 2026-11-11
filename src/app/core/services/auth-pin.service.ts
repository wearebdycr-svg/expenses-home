import { DestroyRef, effect, Injectable, inject, signal } from '@angular/core';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthService } from './supabase-auth.service';

export interface SecuritySession {
  token: string;
  username: string;
  name: string;
  lastActive: number;
  expiresAt: number;
}

export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos estilo Bancolombia
const SESSION_STORAGE_KEY = 'expenses_home_security_session_v2';
const LEGACY_USERS_STORAGE_KEY = 'expenses_home_security_users_v2';
const LEGACY_PIN_STORAGE_KEY = 'expenses_home_pin_hash';
const LEGACY_PIN_SALT_KEY = 'expenses_home_pin_salt';
const BIOMETRIC_ENROLLED_KEY = 'expenses_home_biometric_enrolled_v2';
const FAILED_ATTEMPTS_KEY = 'expenses_home_login_failed_v2';
const PIN_STORAGE_KEY = 'expenses_home_pin_hash_v2';
const PIN_SALT_KEY = 'expenses_home_pin_salt_v2';
const PBKDF2_ITERATIONS = 100_000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000; // 30 segundos tras 5 intentos fallidos

interface AppStateListenerHandle {
  remove: () => Promise<void>;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const cleanHex = hex.trim();
  const length = Math.floor(cleanHex.length / 2);
  const buffer = new ArrayBuffer(length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < length; i++) {
    view[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return view;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hashPinPbkdf2(pin: string, saltHex: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto PBKDF2 no está disponible en este entorno seguro.');
  }

  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return bytesToHex(new Uint8Array(derivedBits));
}

function generateSecureToken(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(24);
    globalThis.crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }
  throw new Error('Generador criptográfico seguro no disponible.');
}

function generateSalt(): string {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Generador criptográfico seguro no disponible para salt.');
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

@Injectable({
  providedIn: 'root',
})
export class AuthPinService {
  private readonly supabaseAuth = inject(SupabaseAuthService);
  private readonly destroyRef = inject(DestroyRef);

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

  private lockoutIntervalId: ReturnType<typeof setInterval> | null = null;
  private sessionCheckIntervalId: ReturnType<typeof setInterval> | null = null;
  private activityCleanupFns: Array<() => void> = [];
  private appStateListenerHandle: AppStateListenerHandle | null = null;
  private lastActivityThrottle = 0;

  constructor() {
    this.checkInitialState();
    this.setupAutoLockListeners();
    this.setupActivityListeners();
    this.startSessionExpiryMonitor();

    effect(() => {
      if (!this.supabaseAuth.isLoading() && !this.supabaseAuth.isAuthenticated()) {
        this.logout();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.cleanupResources();
    });
  }

  private cleanupResources(): void {
    if (this.lockoutIntervalId !== null) {
      clearInterval(this.lockoutIntervalId);
      this.lockoutIntervalId = null;
    }
    if (this.sessionCheckIntervalId !== null) {
      clearInterval(this.sessionCheckIntervalId);
      this.sessionCheckIntervalId = null;
    }
    for (const cleanup of this.activityCleanupFns) {
      cleanup();
    }
    this.activityCleanupFns = [];
    if (this.appStateListenerHandle) {
      void this.appStateListenerHandle.remove().catch(() => {});
      this.appStateListenerHandle = null;
    }
  }

  private clearLegacyInsecureStorage(): void {
    try {
      localStorage.removeItem(LEGACY_USERS_STORAGE_KEY);
      localStorage.removeItem(LEGACY_PIN_STORAGE_KEY);
      localStorage.removeItem(LEGACY_PIN_SALT_KEY);
    } catch {
      // Ignorar errores de almacenamiento
    }
  }

  private checkInitialState(): void {
    if (typeof localStorage === 'undefined') {
      this.isUnlocked.set(false);
      return;
    }

    this.clearLegacyInsecureStorage();

    // Comprobar huella en el dispositivo
    void this.checkBiometricAvailability().catch(() => {});
    const bioEnrolled = localStorage.getItem(BIOMETRIC_ENROLLED_KEY) === 'true';
    this.hasBiometricEnrolled.set(bioEnrolled);
    this.hasCustomPin.set(
      Boolean(localStorage.getItem(PIN_STORAGE_KEY) && localStorage.getItem(PIN_SALT_KEY))
    );

    // Revisar bloqueo por intentos fallidos
    this.checkLockoutStatus();

    // Revisar sesión activa (10 minutos TTL)
    try {
      const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw) as Partial<SecuritySession>;
        const now = Date.now();
        if (
          typeof session.expiresAt === 'number' &&
          now < session.expiresAt &&
          typeof session.username === 'string' &&
          session.username.length > 0
        ) {
          this.currentUser.set({
            username: session.username,
            name: typeof session.name === 'string' && session.name ? session.name : session.username,
          });
          this.sessionExpiresAt.set(session.expiresAt);
          this.isUnlocked.set(true);
          return;
        }
        localStorage.removeItem(SESSION_STORAGE_KEY);
        this.expiredNotice.set('Tu sesión expiró por inactividad (10 minutos).');
      }
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }

    this.isUnlocked.set(false);
  }

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

  private setupActivityListeners(): void {
    if (typeof window === 'undefined') return;
    const events: ReadonlyArray<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'scroll',
      'touchstart',
    ];
    const onUserInteraction = () => {
      const now = Date.now();
      if (now - this.lastActivityThrottle > 10_000) {
        this.lastActivityThrottle = now;
        this.recordActivity();
      }
    };

    events.forEach((evt) => {
      window.addEventListener(evt, onUserInteraction, { passive: true });
      this.activityCleanupFns.push(() => window.removeEventListener(evt, onUserInteraction));
    });
  }

  recordActivity(): void {
    if (!this.isUnlocked() || typeof localStorage === 'undefined') return;
    try {
      const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw) as SecuritySession;
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

  private setupAutoLockListeners(): void {
    if (typeof window === 'undefined') return;

    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener('appStateChange', ({ isActive }) => {
        if (typeof localStorage === 'undefined') {
          this.isUnlocked.set(false);
          return;
        }
        if (!isActive) {
          this.recordActivity();
        } else {
          const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
          if (sessionRaw) {
            try {
              const session = JSON.parse(sessionRaw) as SecuritySession;
              if (Date.now() >= session.expiresAt) {
                this.handleSessionExpired('Tu sesión expiró por inactividad (10 minutos).');
              } else {
                this.recordActivity();
              }
            } catch {
              this.isUnlocked.set(false);
            }
          } else {
            this.isUnlocked.set(false);
          }
        }
      })
        .then((handle) => {
          this.appStateListenerHandle = handle;
        })
        .catch(() => {
          // Ignorar en entornos sin soporte nativo
        });
    }
  }

  private handleSessionExpired(reason: string): void {
    this.lock();
    this.expiredNotice.set(reason);
  }

  private checkLockoutStatus(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const failedDataStr = localStorage.getItem(FAILED_ATTEMPTS_KEY);
      if (!failedDataStr) return;

      const failedData = JSON.parse(failedDataStr) as { lockedUntil?: number };
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
        if (this.lockoutIntervalId !== null) {
          clearInterval(this.lockoutIntervalId);
          this.lockoutIntervalId = null;
        }
        this.isLockedOut.set(false);
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(FAILED_ATTEMPTS_KEY);
        }
      }
    };

    updateRemaining();
    if (this.lockoutIntervalId !== null) clearInterval(this.lockoutIntervalId);
    this.lockoutIntervalId = setInterval(updateRemaining, 1000);
  }

  private resolveSupabaseIdentity(user: User): { username: string; name: string } {
    const username = user.email || user.id;
    const rawMetaName = user.user_metadata?.['full_name'] ?? user.user_metadata?.['name'];
    const name =
      typeof rawMetaName === 'string' && rawMetaName.trim().length > 0
        ? rawMetaName.trim()
        : username;
    return { username, name };
  }

  /**
   * Inicia la sesión de desbloqueo de Fase 2 inmediatamente después de autenticar en Supabase.
   */
  startAuthenticatedSession(): boolean {
    const supaUser = this.supabaseAuth.user();
    if (!this.supabaseAuth.isAuthenticated() || !supaUser) {
      return false;
    }
    const { username, name } = this.resolveSupabaseIdentity(supaUser);
    this.createActiveSession(username, name);
    return true;
  }

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

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(FAILED_ATTEMPTS_KEY);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

      if (Capacitor.isNativePlatform() && this.isBiometricAvailable()) {
        localStorage.setItem(BIOMETRIC_ENROLLED_KEY, 'true');
        this.hasBiometricEnrolled.set(true);
      }
    }

    this.isLockedOut.set(false);
    this.lockoutRemainingSecs.set(0);
    this.currentUser.set({ username, name });
    this.sessionExpiresAt.set(expiresAt);
    this.expiredNotice.set(null);
    this.isUnlocked.set(true);
  }

  private registerFailedAttempt(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const dataStr = localStorage.getItem(FAILED_ATTEMPTS_KEY);
      let count = 1;
      if (dataStr) {
        const data = JSON.parse(dataStr) as { count?: number };
        count = (data.count || 0) + 1;
      }

      if (count >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = Date.now() + LOCKOUT_MS;
        localStorage.setItem(
          FAILED_ATTEMPTS_KEY,
          JSON.stringify({ count, lockedUntil })
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
   * Desbloqueo de Fase 2 con Huella/Rostro únicamente cuando la sesión Supabase es válida.
   */
  async unlockWithBiometric(): Promise<{ success: boolean; error?: string }> {
    if (!this.supabaseAuth.isAuthenticated() || !this.supabaseAuth.user()) {
      return {
        success: false,
        error: 'Debes iniciar sesión con tu cuenta antes de usar biometría.',
      };
    }

    const supaUser = this.supabaseAuth.user();
    const identity = this.currentUser() || (supaUser ? this.resolveSupabaseIdentity(supaUser) : null);
    if (!identity) {
      return {
        success: false,
        error: 'No hay una identidad de usuario verificada para desbloquear.',
      };
    }

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
        negativeButtonText: 'Usar PIN',
        maxAttempts: 3,
      });

      this.createActiveSession(identity.username, identity.name);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err || '');
      return { success: false, error: msg };
    }
  }

  /**
   * Desbloqueo de Fase 2 mediante PIN personalizado verificado con PBKDF2.
   */
  async unlock(pin: string, _rememberDevice = true): Promise<{ success: boolean; error?: string }> {
    if (!this.supabaseAuth.isAuthenticated() || !this.supabaseAuth.user()) {
      return {
        success: false,
        error: 'Debes iniciar sesión con tu cuenta antes de ingresar el PIN.',
      };
    }

    if (this.isLockedOut()) {
      return {
        success: false,
        error: `Acceso bloqueado por seguridad. Espera ${this.lockoutRemainingSecs()} segundos.`,
      };
    }

    if (typeof localStorage === 'undefined') {
      return { success: false, error: 'Almacenamiento seguro no disponible.' };
    }

    const savedHash = localStorage.getItem(PIN_STORAGE_KEY);
    const salt = localStorage.getItem(PIN_SALT_KEY);
    if (!savedHash || !salt) {
      return {
        success: false,
        error: 'No hay un PIN personalizado configurado. Configura tu PIN primero.',
      };
    }

    let isValid = false;
    try {
      const computed = await hashPinPbkdf2(pin, salt);
      isValid = constantTimeEqual(computed, savedHash);
    } catch {
      return {
        success: false,
        error: 'No es posible verificar el PIN en este entorno sin Web Crypto.',
      };
    }

    if (isValid) {
      const supaUser = this.supabaseAuth.user();
      const identity =
        this.currentUser() || (supaUser ? this.resolveSupabaseIdentity(supaUser) : null);
      if (!identity) {
        return { success: false, error: 'No existe usuario autenticado en Supabase.' };
      }
      this.createActiveSession(identity.username, identity.name);
      return { success: true };
    }

    this.registerFailedAttempt();
    return { success: false, error: 'PIN incorrecto.' };
  }

  async setCustomPin(newPin: string, currentPin?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.supabaseAuth.isAuthenticated()) {
      return {
        success: false,
        error: 'Debes iniciar sesión con tu cuenta antes de configurar el PIN.',
      };
    }

    if (!newPin || !/^\d{4,6}$/.test(newPin)) {
      return { success: false, error: 'El PIN debe tener entre 4 y 6 dígitos numéricos.' };
    }

    if (typeof localStorage === 'undefined') {
      return { success: false, error: 'Almacenamiento seguro no disponible.' };
    }

    const savedHash = localStorage.getItem(PIN_STORAGE_KEY);
    const savedSalt = localStorage.getItem(PIN_SALT_KEY);
    const hasExistingPin = Boolean(savedHash && savedSalt);

    if (hasExistingPin && savedHash && savedSalt) {
      if (!currentPin) {
        return { success: false, error: 'Debes ingresar tu PIN actual para cambiarlo.' };
      }
      try {
        const computedCurrent = await hashPinPbkdf2(currentPin, savedSalt);
        if (!constantTimeEqual(computedCurrent, savedHash)) {
          return { success: false, error: 'El PIN actual es incorrecto.' };
        }
      } catch {
        return {
          success: false,
          error: 'No es posible validar el PIN en este entorno sin Web Crypto.',
        };
      }
    }

    try {
      const salt = generateSalt();
      const hash = await hashPinPbkdf2(newPin, salt);
      localStorage.setItem(PIN_STORAGE_KEY, hash);
      localStorage.setItem(PIN_SALT_KEY, salt);
      this.hasCustomPin.set(true);
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'No es posible proteger el PIN en este entorno sin Web Crypto.',
      };
    }
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

  lock(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    this.sessionExpiresAt.set(0);
    this.isUnlocked.set(false);
  }

  logout(): void {
    this.lock();
    this.currentUser.set(null);
  }
}
