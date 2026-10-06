import { TestBed } from '@angular/core/testing';
import { SupabaseAuthService } from './supabase-auth.service';
import { SupabaseService } from './supabase.service';

describe('SupabaseAuthService', () => {
  let service: SupabaseAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SupabaseAuthService, SupabaseService],
    });
    service = TestBed.inject(SupabaseAuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have mock session in test environment', () => {
    expect(service.isAuthenticated()).toBe(true);
    expect(service.session()).toBeTruthy();
    expect(service.user()?.email).toBe('test@familia.com');
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
