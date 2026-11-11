import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SupabaseAuthService } from './supabase-auth.service';
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
