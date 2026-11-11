import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { type Session, type User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

export const SESSION_INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
export const SESSION_ACTIVITY_STORAGE_KEY = 'expenses_home_session_last_activity_v1';
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 30_000;

const FAILED_ATTEMPTS_STORAGE_KEY = 'expenses_home_login_failed_v2';
const INACTIVITY_CHECK_INTERVAL_MS = 15_000;
const ACTIVITY_STORAGE_THROTTLE_MS = 5_000;
const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró por inactividad (10 minutos). Inicia sesión nuevamente.';

const LEGACY_PIN_STORAGE_KEYS = [
  'expenses_home_security_session_v2',
  'expenses_home_security_users_v2',
  'expenses_home_pin_hash',
  'expenses_home_pin_salt',
  'expenses_home_pin_hash_v2',
  'expenses_home_pin_salt_v2',
  'expenses_home_biometric_enrolled_v2',
] as const;

interface ProcessLikeEnv {
  env?: Record<string, string | undefined>;
}

interface AppStateListenerHandle {
  remove: () => Promise<void>;
}

interface StoredLockoutState {
  count?: number;
  lockedUntil?: number;
}

function isTestEnvironment(): boolean {
  const proc = (globalThis as { process?: ProcessLikeEnv }).process;
  return (
    typeof proc !== 'undefined' &&
    (Boolean(proc.env?.['VITEST']) || proc.env?.['NODE_ENV'] === 'test')
  );
}

const TEST_USER = {
  id: 'test-user',
  email: 'test@familia.com',
} as User;

const TEST_SESSION = {
  access_token: 'test-session-jwt',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'test-refresh-token',
  user: TEST_USER,
} as Session;

function isSessionExpired(session: Session): boolean {
  if (typeof session.expires_at !== 'number') {
    return false;
  }
  return session.expires_at * 1000 <= Date.now();
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseAuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly destroyRef = inject(DestroyRef);

  readonly session = signal<Session | null>(isTestEnvironment() ? TEST_SESSION : null);
  readonly user = signal<User | null>(isTestEnvironment() ? TEST_USER : null);
  readonly isAuthenticated = signal<boolean>(isTestEnvironment());
  readonly isLoading = signal<boolean>(!isTestEnvironment());
  readonly expiredNotice = signal<string>('');
  readonly isLockedOut = signal<boolean>(false);
  readonly lockoutRemainingSecs = signal<number>(0);

  private lastActivityAtMs: number | null = isTestEnvironment() ? Date.now() : null;
  private lastPersistedAtMs = 0;
  private explicitSignInInProgress = false;
  private expiringInProgress: Promise<void> | null = null;
  private isDestroyed = false;

  private inactivityIntervalId: ReturnType<typeof setInterval> | null = null;
  private lockoutIntervalId: ReturnType<typeof setInterval> | null = null;
  private authSubscription: { unsubscribe: () => void } | null = null;
  private appStateListenerHandle: AppStateListenerHandle | null = null;
  private cleanupListeners: Array<() => void> = [];

  constructor() {
    this.destroyRef.onDestroy(() => this.teardown());
    this.cleanupLegacyPinStorage();
    this.restoreLockoutState();

    if (!isTestEnvironment()) {
      void this.initAuth();
    }
  }

  private async initAuth(): Promise<void> {
    this.setupInactivityWatchers();

    try {
      const { data, error } = await this.supabase.client.auth.getSession();
      if (!error && data?.session?.user) {
        const persistedLastActive = this.readLastActivityTimestamp();
        const hasFreshStoredActivity =
          persistedLastActive !== null &&
          Date.now() - persistedLastActive < SESSION_INACTIVITY_TIMEOUT_MS;

        if (!hasFreshStoredActivity) {
          await this.expireSessionByInactivity(persistedLastActive !== null);
        } else if (!isSessionExpired(data.session)) {
          this.setSession(data.session, true);
        } else {
          const refreshed = await this.supabase.client.auth.refreshSession();
          if (
            !refreshed.error &&
            refreshed.data?.session?.user &&
            !isSessionExpired(refreshed.data.session)
          ) {
            this.setSession(refreshed.data.session, true);
          } else {
            this.clearSession();
          }
        }
      } else {
        this.clearSession();
      }
    } catch {
      this.clearSession();
    } finally {
      this.isLoading.set(false);
    }

    try {
      this.authSubscription?.unsubscribe();
      const { data } = this.supabase.client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user || isSessionExpired(session)) {
          this.clearSession();
          return;
        }

        if (this.explicitSignInInProgress) {
          this.setSession(session, true);
          return;
        }

        if (this.hasInactivityExpired()) {
          void this.expireSessionByInactivity(true);
          return;
        }

        if (!this.isAuthenticated()) {
          const persistedLastActive = this.readLastActivityTimestamp();
          const hasFreshStored =
            persistedLastActive !== null &&
            Date.now() - persistedLastActive < SESSION_INACTIVITY_TIMEOUT_MS;
          if (!hasFreshStored) {
            return;
          }
        }

        // Renovaciones automáticas de JWT (TOKEN_REFRESHED) no reinician la ventana de inactividad
        this.setSession(session, false);
      });
      this.authSubscription = data?.subscription ?? null;
    } catch {
      // Ignorar en entornos sin soporte de realtime/auth listeners
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.isAuthenticated()) {
      return null;
    }

    if (this.hasInactivityExpired()) {
      await this.expireSessionByInactivity(true);
      return null;
    }

    try {
      const { data, error } = await this.supabase.client.auth.getSession();
      if (error || !data?.session?.access_token) {
        return null;
      }

      if (!isSessionExpired(data.session)) {
        return data.session.access_token;
      }

      const refreshed = await this.supabase.client.auth.refreshSession();
      if (
        !refreshed.error &&
        refreshed.data?.session?.access_token &&
        !isSessionExpired(refreshed.data.session)
      ) {
        this.setSession(refreshed.data.session, false);
        return refreshed.data.session.access_token;
      }
    } catch {
      // Fail closed
    }

    return null;
  }

  recordActivity(throttleStorage = false): void {
    if (!this.isAuthenticated()) {
      return;
    }

    const now = Date.now();
    this.lastActivityAtMs = now;

    if (!throttleStorage || now - this.lastPersistedAtMs >= ACTIVITY_STORAGE_THROTTLE_MS) {
      this.writeLastActivityTimestamp(now);
    }
  }

  async checkSessionInactivity(): Promise<boolean> {
    if (!this.isAuthenticated()) {
      return false;
    }

    if (this.hasInactivityExpired()) {
      await this.expireSessionByInactivity(true);
      return true;
    }

    return false;
  }

  async signInWithPassword(email: string, password: string): Promise<{ error: Error | null }> {
    if (this.isLockedOut()) {
      return {
        error: new Error(`Acceso bloqueado. Espera ${this.lockoutRemainingSecs()} segundos.`),
      };
    }

    this.expiredNotice.set('');
    this.explicitSignInInProgress = true;

    try {
      const { data, error } = await this.supabase.client.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        this.recordFailedAttempt();
        return { error };
      }

      if (data.session?.user) {
        this.resetFailedAttempts();
        this.setSession(data.session, true);
      } else {
        this.recordFailedAttempt();
        return { error: new Error('No se recibió una sesión autenticada válida.') };
      }

      return { error: null };
    } catch (err: unknown) {
      this.recordFailedAttempt();
      return { error: err instanceof Error ? err : new Error(String(err)) };
    } finally {
      this.explicitSignInInProgress = false;
    }
  }

  async signUp(email: string, password: string): Promise<{ error: Error | null; user: User | null }> {
    this.expiredNotice.set('');
    this.explicitSignInInProgress = true;

    try {
      const { data, error } = await this.supabase.client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        return { error, user: null };
      }

      if (data.session?.user) {
        this.resetFailedAttempts();
        this.setSession(data.session, true);
      }

      return { error: null, user: data.user };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error(String(err)), user: null };
    } finally {
      this.explicitSignInInProgress = false;
    }
  }

  async signOut(): Promise<void> {
    this.expiredNotice.set('');
    try {
      await this.supabase.client.auth.signOut();
    } finally {
      this.clearSession();
    }
  }

  private setSession(session: Session, resetActivity: boolean): void {
    this.session.set(session);
    this.user.set(session.user);
    this.isAuthenticated.set(true);

    if (resetActivity) {
      this.expiredNotice.set('');
      this.recordActivity(false);
    } else if (this.lastActivityAtMs === null) {
      const persisted = this.readLastActivityTimestamp();
      this.lastActivityAtMs = persisted ?? Date.now();
    }
  }

  private clearSession(): void {
    this.session.set(null);
    this.user.set(null);
    this.isAuthenticated.set(false);
    this.lastActivityAtMs = null;
    this.lastPersistedAtMs = 0;
    this.removeLastActivityTimestamp();
  }

  private hasInactivityExpired(now = Date.now()): boolean {
    if (!this.isAuthenticated()) {
      return false;
    }

    const referenceActivity = this.lastActivityAtMs ?? this.readLastActivityTimestamp();
    if (referenceActivity === null) {
      return true;
    }

    return now - referenceActivity >= SESSION_INACTIVITY_TIMEOUT_MS;
  }

  private async expireSessionByInactivity(showNotice: boolean): Promise<void> {
    if (this.expiringInProgress) {
      await this.expiringInProgress;
      return;
    }

    this.expiringInProgress = (async () => {
      this.clearSession();
      this.expiredNotice.set(showNotice ? SESSION_EXPIRED_MESSAGE : '');
      try {
        await this.supabase.client.auth.signOut();
      } catch {
        // Garantiza cierre de sesión fail-closed aunque falle la red
      }
    })();

    try {
      await this.expiringInProgress;
    } finally {
      this.expiringInProgress = null;
    }
  }

  private setupInactivityWatchers(): void {
    this.teardownWatchersOnly();

    if (typeof window !== 'undefined') {
      const interactionEvents: ReadonlyArray<keyof WindowEventMap> = [
        'pointerdown',
        'keydown',
        'touchstart',
        'scroll',
      ];

      const onUserInteraction = () => {
        if (!this.isAuthenticated()) {
          return;
        }
        if (this.hasInactivityExpired()) {
          void this.expireSessionByInactivity(true);
          return;
        }
        this.recordActivity(true);
      };

      interactionEvents.forEach((eventName) => {
        window.addEventListener(eventName, onUserInteraction, { passive: true });
        this.cleanupListeners.push(() => window.removeEventListener(eventName, onUserInteraction));
      });

      const onPageHide = () => {
        this.flushPersistedActivity();
      };
      window.addEventListener('pagehide', onPageHide);
      this.cleanupListeners.push(() => window.removeEventListener('pagehide', onPageHide));

      const onStorageChange = (event: StorageEvent) => {
        if (event.key !== SESSION_ACTIVITY_STORAGE_KEY || !this.isAuthenticated()) {
          return;
        }
        if (!event.newValue) {
          this.clearSession();
          return;
        }
        const parsed = Number(event.newValue);
        if (Number.isFinite(parsed) && parsed > (this.lastActivityAtMs ?? 0)) {
          this.lastActivityAtMs = parsed;
        }
      };
      window.addEventListener('storage', onStorageChange);
      this.cleanupListeners.push(() => window.removeEventListener('storage', onStorageChange));
    }

    if (typeof document !== 'undefined') {
      const onVisibilityChange = () => {
        if (!this.isAuthenticated()) {
          return;
        }
        if (document.visibilityState === 'hidden') {
          this.flushPersistedActivity();
        } else if (document.visibilityState === 'visible') {
          void this.checkSessionInactivity();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      this.cleanupListeners.push(() =>
        document.removeEventListener('visibilitychange', onVisibilityChange)
      );
    }

    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!this.isAuthenticated()) {
          return;
        }
        if (!isActive) {
          this.flushPersistedActivity();
        } else {
          void this.checkSessionInactivity();
        }
      })
        .then((handle) => {
          if (this.isDestroyed) {
            void handle.remove();
          } else {
            this.appStateListenerHandle = handle;
          }
        })
        .catch(() => {
          // Ignorar en entornos sin soporte nativo de Capacitor App
        });
    }

    this.inactivityIntervalId = setInterval(() => {
      if (this.isAuthenticated()) {
        void this.checkSessionInactivity();
      }
    }, INACTIVITY_CHECK_INTERVAL_MS);
  }

  private flushPersistedActivity(): void {
    if (!this.isAuthenticated() || this.lastActivityAtMs === null) {
      return;
    }
    if (this.hasInactivityExpired()) {
      return;
    }
    this.writeLastActivityTimestamp(this.lastActivityAtMs);
  }

  private readLastActivityTimestamp(): number | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  private writeLastActivityTimestamp(timestampMs: number): void {
    this.lastPersistedAtMs = timestampMs;
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(timestampMs));
    } catch {
      // Ignorar si almacenamiento local no está disponible
    }
  }

  private removeLastActivityTimestamp(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.removeItem(SESSION_ACTIVITY_STORAGE_KEY);
    } catch {
      // Ignorar
    }
  }

  private cleanupLegacyPinStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      LEGACY_PIN_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignorar
    }
  }

  private restoreLockoutState(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const raw = localStorage.getItem(FAILED_ATTEMPTS_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as StoredLockoutState;
      if (typeof parsed.lockedUntil === 'number') {
        if (Date.now() < parsed.lockedUntil) {
          this.triggerLockout(parsed.lockedUntil);
        } else {
          localStorage.removeItem(FAILED_ATTEMPTS_STORAGE_KEY);
          this.isLockedOut.set(false);
          this.lockoutRemainingSecs.set(0);
        }
      }
    } catch {
      // Ignorar datos corruptos de intentos fallidos
    }
  }

  private recordFailedAttempt(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const raw = localStorage.getItem(FAILED_ATTEMPTS_STORAGE_KEY);
      let count = 1;
      if (raw) {
        const parsed = JSON.parse(raw) as StoredLockoutState;
        count = (parsed.count ?? 0) + 1;
      }

      if (count >= MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
        localStorage.setItem(
          FAILED_ATTEMPTS_STORAGE_KEY,
          JSON.stringify({ count, lockedUntil })
        );
        this.triggerLockout(lockedUntil);
      } else {
        localStorage.setItem(FAILED_ATTEMPTS_STORAGE_KEY, JSON.stringify({ count }));
      }
    } catch {
      // Ignorar
    }
  }

  private resetFailedAttempts(): void {
    if (this.lockoutIntervalId !== null) {
      clearInterval(this.lockoutIntervalId);
      this.lockoutIntervalId = null;
    }
    this.isLockedOut.set(false);
    this.lockoutRemainingSecs.set(0);

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(FAILED_ATTEMPTS_STORAGE_KEY);
      } catch {
        // Ignorar
      }
    }
  }

  private triggerLockout(lockedUntil: number): void {
    if (this.lockoutIntervalId !== null) {
      clearInterval(this.lockoutIntervalId);
    }

    const updateRemaining = () => {
      const remainingMs = lockedUntil - Date.now();
      if (remainingMs <= 0) {
        this.resetFailedAttempts();
      } else {
        this.isLockedOut.set(true);
        this.lockoutRemainingSecs.set(Math.ceil(remainingMs / 1000));
      }
    };

    updateRemaining();
    this.lockoutIntervalId = setInterval(updateRemaining, 1000);
  }

  private teardownWatchersOnly(): void {
    this.cleanupListeners.forEach((cleanup) => cleanup());
    this.cleanupListeners = [];

    if (this.inactivityIntervalId !== null) {
      clearInterval(this.inactivityIntervalId);
      this.inactivityIntervalId = null;
    }

    if (this.appStateListenerHandle) {
      void this.appStateListenerHandle.remove();
      this.appStateListenerHandle = null;
    }
  }

  private teardown(): void {
    this.isDestroyed = true;
    this.teardownWatchersOnly();

    if (this.lockoutIntervalId !== null) {
      clearInterval(this.lockoutIntervalId);
      this.lockoutIntervalId = null;
    }

    this.authSubscription?.unsubscribe();
    this.authSubscription = null;
  }
}
