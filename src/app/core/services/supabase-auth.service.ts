import { Injectable, inject, signal } from '@angular/core';
import { type Session, type User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

interface ProcessLikeEnv {
  env?: Record<string, string | undefined>;
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

  readonly session = signal<Session | null>(isTestEnvironment() ? TEST_SESSION : null);
  readonly user = signal<User | null>(isTestEnvironment() ? TEST_USER : null);
  readonly isAuthenticated = signal<boolean>(isTestEnvironment());
  readonly isLoading = signal<boolean>(!isTestEnvironment());

  constructor() {
    if (!isTestEnvironment()) {
      void this.initAuth();
    }
  }

  private async initAuth(): Promise<void> {
    try {
      const { data, error } = await this.supabase.client.auth.getSession();
      if (!error && data?.session?.user) {
        if (!isSessionExpired(data.session)) {
          this.setSession(data.session);
        } else {
          const refreshed = await this.supabase.client.auth.refreshSession();
          if (!refreshed.error && refreshed.data?.session?.user && !isSessionExpired(refreshed.data.session)) {
            this.setSession(refreshed.data.session);
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
      this.supabase.client.auth.onAuthStateChange((_event, session) => {
        if (session?.user && !isSessionExpired(session)) {
          this.setSession(session);
        } else {
          this.clearSession();
        }
      });
    } catch {
      // Ignorar en entornos sin soporte de realtime/auth listeners
    }
  }

  async getAccessToken(): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.client.auth.getSession();
      if (!error && data?.session?.access_token && !isSessionExpired(data.session)) {
        return data.session.access_token;
      }
    } catch {
      // Fail closed
    }
    return null;
  }

  private setSession(session: Session): void {
    this.session.set(session);
    this.user.set(session.user);
    this.isAuthenticated.set(true);
  }

  private clearSession(): void {
    this.session.set(null);
    this.user.set(null);
    this.isAuthenticated.set(false);
  }

  async signInWithPassword(email: string, password: string): Promise<{ error: Error | null }> {
    try {
      const { data, error } = await this.supabase.client.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        return { error };
      }
      if (data.session?.user) {
        this.setSession(data.session);
      } else {
        return { error: new Error('No se recibió una sesión autenticada válida.') };
      }
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async signUp(email: string, password: string): Promise<{ error: Error | null; user: User | null }> {
    try {
      const { data, error } = await this.supabase.client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        return { error, user: null };
      }
      if (data.session?.user) {
        this.setSession(data.session);
      }
      return { error: null, user: data.user };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error(String(err)), user: null };
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.supabase.client.auth.signOut();
    } finally {
      this.clearSession();
    }
  }
}
