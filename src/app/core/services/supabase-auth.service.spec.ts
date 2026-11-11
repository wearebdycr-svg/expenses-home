import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import {
  LOGIN_LOCKOUT_MS,
  MAX_LOGIN_ATTEMPTS,
  SESSION_ACTIVITY_STORAGE_KEY,
  SESSION_INACTIVITY_TIMEOUT_MS,
  SupabaseAuthService,
} from './supabase-auth.service';
import { SupabaseService } from './supabase.service';

describe('SupabaseAuthService', () => {
  let service: SupabaseAuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [SupabaseAuthService, SupabaseService],
    });
    service = TestBed.inject(SupabaseAuthService);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have mock session in test environment', () => {
    expect(service.isAuthenticated()).toBe(true);
    expect(service.session()).toBeTruthy();
    expect(service.user()?.email).toBe('test@familia.com');
  });

  it('should validate an expired session fails closed during initAuth', async () => {
    TestBed.resetTestingModule();
    localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(Date.now() - 1000));
    const expiredSession = {
      access_token: 'expired-jwt',
      expires_at: Math.floor((Date.now() - 60_000) / 1000),
      user: { id: 'u1', email: 'charlie@familia.com' },
    };

    TestBed.configureTestingModule({
      providers: [
        SupabaseAuthService,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              auth: {
                getSession: vi.fn().mockResolvedValue({ data: { session: expiredSession }, error: null }),
                refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: new Error('expired') }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
                signInWithPassword: vi.fn(),
                signUp: vi.fn(),
                signOut: vi.fn().mockResolvedValue({ error: null }),
              },
            },
          },
        },
      ],
    });

    const instance = TestBed.inject(SupabaseAuthService);
    await (instance as unknown as { initAuth: () => Promise<void> }).initAuth();
    expect(instance.isAuthenticated()).toBe(false);
    expect(instance.session()).toBeNull();
  });

  it('should restore valid session during initAuth when activity is within 10 minutes', async () => {
    TestBed.resetTestingModule();
    const recentActivity = Date.now() - 2 * 60 * 1000;
    localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(recentActivity));
    const validSession = {
      access_token: 'valid-jwt',
      expires_at: Math.floor((Date.now() + 3600_000) / 1000),
      user: { id: 'u1', email: 'charlie@familia.com' },
    };

    TestBed.configureTestingModule({
      providers: [
        SupabaseAuthService,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              auth: {
                getSession: vi.fn().mockResolvedValue({ data: { session: validSession }, error: null }),
                refreshSession: vi.fn(),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
                signInWithPassword: vi.fn(),
                signUp: vi.fn(),
                signOut: vi.fn().mockResolvedValue({ error: null }),
              },
            },
          },
        },
      ],
    });

    const instance = TestBed.inject(SupabaseAuthService);
    await (instance as unknown as { initAuth: () => Promise<void> }).initAuth();
    expect(instance.isAuthenticated()).toBe(true);
    expect(instance.session()?.access_token).toBe('valid-jwt');
    expect(instance.expiredNotice()).toBe('');
  });

  it('should expire session and show notice during initAuth when persisted inactivity >= 10 minutes', async () => {
    TestBed.resetTestingModule();
    const staleActivity = Date.now() - SESSION_INACTIVITY_TIMEOUT_MS - 1000;
    localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(staleActivity));
    const signOutSpy = vi.fn().mockResolvedValue({ error: null });
    const validSupabaseSession = {
      access_token: 'still-valid-server-jwt',
      expires_at: Math.floor((Date.now() + 3600_000) / 1000),
      user: { id: 'u1', email: 'charlie@familia.com' },
    };

    TestBed.configureTestingModule({
      providers: [
        SupabaseAuthService,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              auth: {
                getSession: vi.fn().mockResolvedValue({ data: { session: validSupabaseSession }, error: null }),
                refreshSession: vi.fn(),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
                signInWithPassword: vi.fn(),
                signUp: vi.fn(),
                signOut: signOutSpy,
              },
            },
          },
        },
      ],
    });

    const instance = TestBed.inject(SupabaseAuthService);
    await (instance as unknown as { initAuth: () => Promise<void> }).initAuth();

    expect(instance.isAuthenticated()).toBe(false);
    expect(instance.session()).toBeNull();
    expect(signOutSpy).toHaveBeenCalled();
    expect(instance.expiredNotice()).toContain('10 minutos');
  });

  it('should fail closed during initAuth when session exists without recorded activity timestamp', async () => {
    TestBed.resetTestingModule();
    const signOutSpy = vi.fn().mockResolvedValue({ error: null });
    const validSupabaseSession = {
      access_token: 'legacy-jwt',
      expires_at: Math.floor((Date.now() + 3600_000) / 1000),
      user: { id: 'u1', email: 'charlie@familia.com' },
    };

    TestBed.configureTestingModule({
      providers: [
        SupabaseAuthService,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              auth: {
                getSession: vi.fn().mockResolvedValue({ data: { session: validSupabaseSession }, error: null }),
                refreshSession: vi.fn(),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
                signInWithPassword: vi.fn(),
                signUp: vi.fn(),
                signOut: signOutSpy,
              },
            },
          },
        },
      ],
    });

    const instance = TestBed.inject(SupabaseAuthService);
    await (instance as unknown as { initAuth: () => Promise<void> }).initAuth();

    expect(instance.isAuthenticated()).toBe(false);
    expect(instance.session()).toBeNull();
    expect(signOutSpy).toHaveBeenCalled();
    expect(instance.expiredNotice()).toBe('');
  });

  it('should expire session after 10 minutes of inactivity and extend deadline on activity', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-01-01T12:00:00Z');
    vi.setSystemTime(start);

    service.recordActivity();
    vi.advanceTimersByTime(SESSION_INACTIVITY_TIMEOUT_MS - 10_000);
    expect(await service.checkSessionInactivity()).toBe(false);
    expect(service.isAuthenticated()).toBe(true);

    service.recordActivity();
    vi.advanceTimersByTime(SESSION_INACTIVITY_TIMEOUT_MS - 10_000);
    expect(await service.checkSessionInactivity()).toBe(false);
    expect(service.isAuthenticated()).toBe(true);

    vi.advanceTimersByTime(10_000);
    expect(await service.checkSessionInactivity()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.session()).toBeNull();
    expect(service.expiredNotice()).toContain('10 minutos');
  });

  it('should refuse getAccessToken and expire session when inactivity window elapsed', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-01-01T12:00:00Z');
    vi.setSystemTime(start);

    TestBed.resetTestingModule();
    const signOutSpy = vi.fn().mockResolvedValue({ error: null });
    const validSession = {
      access_token: 'active-jwt',
      expires_at: Math.floor((Date.now() + 3600_000) / 1000),
      user: { id: 'u1', email: 'charlie@familia.com' },
    };

    TestBed.configureTestingModule({
      providers: [
        SupabaseAuthService,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              auth: {
                getSession: vi.fn().mockResolvedValue({ data: { session: validSession }, error: null }),
                refreshSession: vi.fn(),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
                signInWithPassword: vi.fn(),
                signUp: vi.fn(),
                signOut: signOutSpy,
              },
            },
          },
        },
      ],
    });

    const instance = TestBed.inject(SupabaseAuthService);
    instance.recordActivity();
    expect(await instance.getAccessToken()).toBe('active-jwt');

    vi.advanceTimersByTime(SESSION_INACTIVITY_TIMEOUT_MS);
    expect(await instance.getAccessToken()).toBeNull();
    expect(instance.isAuthenticated()).toBe(false);
    expect(signOutSpy).toHaveBeenCalled();
  });

  it('should not reset inactivity window on TOKEN_REFRESHED and should expire idle session', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-01-01T12:00:00Z');
    vi.setSystemTime(start);
    TestBed.resetTestingModule();

    const authListener: { cb: ((event: string, session: unknown) => void) | null } = { cb: null };
    const validSession = {
      access_token: 'jwt-1',
      expires_at: Math.floor((Date.now() + 3600_000) / 1000),
      user: { id: 'u1', email: 'charlie@familia.com' },
    };
    localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(Date.now()));

    TestBed.configureTestingModule({
      providers: [
        SupabaseAuthService,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              auth: {
                getSession: vi.fn().mockResolvedValue({ data: { session: validSession }, error: null }),
                refreshSession: vi.fn(),
                onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
                  authListener.cb = cb;
                  return { data: { subscription: { unsubscribe: () => {} } } };
                },
                signInWithPassword: vi.fn(),
                signUp: vi.fn(),
                signOut: vi.fn().mockResolvedValue({ error: null }),
              },
            },
          },
        },
      ],
    });

    const instance = TestBed.inject(SupabaseAuthService);
    await (instance as unknown as { initAuth: () => Promise<void> }).initAuth();
    expect(instance.isAuthenticated()).toBe(true);
    expect(authListener.cb).not.toBeNull();

    // A los 6 minutos llega un refresh en segundo plano: sigue autenticado pero NO extiende los 10 min
    vi.advanceTimersByTime(6 * 60 * 1000);
    authListener.cb?.('TOKEN_REFRESHED', {
      ...validSession,
      access_token: 'jwt-2',
      expires_at: Math.floor((Date.now() + 3600_000) / 1000),
    });
    expect(instance.isAuthenticated()).toBe(true);
    expect(instance.session()?.access_token).toBe('jwt-2');

    // Al minuto 10 exacto desde el inicio (solo 4 min después del refresh), debe expirar por inactividad
    vi.advanceTimersByTime(4 * 60 * 1000);
    await instance.checkSessionInactivity();
    expect(instance.isAuthenticated()).toBe(false);
    expect(instance.expiredNotice()).toContain('10 minutos');
  });

  it('should trigger 30s lockout after 5 failed signInWithPassword attempts', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-01-01T12:00:00Z');
    vi.setSystemTime(start);
    TestBed.resetTestingModule();

    const signInSpy = vi.fn().mockResolvedValue({
      data: { session: null, user: null },
      error: new Error('Invalid login credentials'),
    });

    TestBed.configureTestingModule({
      providers: [
        SupabaseAuthService,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              auth: {
                getSession: vi.fn(),
                refreshSession: vi.fn(),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
                signInWithPassword: signInSpy,
                signUp: vi.fn(),
                signOut: vi.fn().mockResolvedValue({ error: null }),
              },
            },
          },
        },
      ],
    });

    const instance = TestBed.inject(SupabaseAuthService);
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      await instance.signInWithPassword('charlie@familia.com', 'wrong');
    }

    expect(instance.isLockedOut()).toBe(true);
    expect(instance.lockoutRemainingSecs()).toBe(30);

    const lockedResult = await instance.signInWithPassword('charlie@familia.com', 'correct');
    expect(lockedResult.error?.message).toContain('Acceso bloqueado');
    expect(signInSpy).toHaveBeenCalledTimes(MAX_LOGIN_ATTEMPTS);

    vi.advanceTimersByTime(LOGIN_LOCKOUT_MS);
    expect(instance.isLockedOut()).toBe(false);
    expect(instance.lockoutRemainingSecs()).toBe(0);
  });

  it('should sign in with password successfully', async () => {
    const result = await service.signInWithPassword('familia@test.com', '123456');
    expect(result.error).toBeNull();
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should sign up successfully', async () => {
    const result = await service.signUp('familia@test.com', '123456');
    expect(result.error).toBeNull();
  });

  it('should sign out successfully', async () => {
    await service.signOut();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.session()).toBeNull();
  });
});
