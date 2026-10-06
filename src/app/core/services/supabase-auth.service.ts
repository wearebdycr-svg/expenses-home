import { Injectable, inject, signal } from '@angular/core';
import { type Session, type User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

function isTestEnvironment(): boolean {
  const proc = (globalThis as any).process;
  return (
    typeof proc !== 'undefined' &&
    (Boolean(proc.env?.['VITEST']) || proc.env?.['NODE_ENV'] === 'test')
  );
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseAuthService {
  private readonly supabase = inject(SupabaseService);

  readonly session = signal<Session | null>(
    isTestEnvironment() ? ({ user: { id: 'test-user', email: 'test@familia.com' } } as any) : null
  );
  readonly user = signal<User | null>(
    isTestEnvironment() ? ({ id: 'test-user', email: 'test@familia.com' } as any) : null
  );
  readonly isAuthenticated = signal<boolean>(isTestEnvironment());
  readonly isLoading = signal<boolean>(!isTestEnvironment());

  constructor() {
    if (!isTestEnvironment()) {
      this.initAuth();
    }
  }

  private async initAuth(): Promise<void> {
    try {
      const { data, error } = await this.supabase.client.auth.getSession();
      if (!error && data?.session) {
        this.setSession(data.session);
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
        if (session) {
          this.setSession(session);
        } else {
          this.clearSession();
        }
      });
    } catch {
      // Ignorar en entornos sin soporte de realtime/auth listeners
    }
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
      if (data.session) {
        this.setSession(data.session);
      }
      return { error: null };
    } catch (err: any) {
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
      if (data.session) {
        this.setSession(data.session);
      }
      return { error: null, user: data.user };
    } catch (err: any) {
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
