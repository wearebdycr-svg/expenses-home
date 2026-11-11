import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { vi } from 'vitest';
import { AuthPinService, INACTIVITY_TIMEOUT_MS } from './auth-pin.service';
import { SupabaseAuthService } from './supabase-auth.service';

describe('AuthPinService', () => {
  let service: AuthPinService;
  let supabaseAuth: SupabaseAuthService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    supabaseAuth = TestBed.inject(SupabaseAuthService);
    service = TestBed.inject(AuthPinService);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('initializes in locked state when no session exists', () => {
    expect(service.isUnlocked()).toBe(false);
    expect(service.hasCustomPin()).toBe(false);
  });

  it('rejects default legacy PIN 2026 when no custom PIN has been configured', async () => {
    const res = await service.unlock('2026', true);
    expect(res.success).toBe(false);
    expect(service.isUnlocked()).toBe(false);
    expect(res.error).toContain('No hay un PIN personalizado configurado');
  });

  it('allows authenticated user to set initial custom PIN with PBKDF2 and unlock with it', async () => {
    const setRes = await service.setCustomPin('1423');
    expect(setRes.success).toBe(true);
    expect(service.hasCustomPin()).toBe(true);

    const savedHash = localStorage.getItem('expenses_home_pin_hash_v2');
    const savedSalt = localStorage.getItem('expenses_home_pin_salt_v2');
    expect(savedHash).toBeTruthy();
    expect(savedSalt).toBeTruthy();
    expect(savedHash).not.toBe('1423');

    const badRes = await service.unlock('2026');
    expect(badRes.success).toBe(false);
    expect(service.isUnlocked()).toBe(false);

    const okRes = await service.unlock('1423');
    expect(okRes.success).toBe(true);
    expect(service.isUnlocked()).toBe(true);
    expect(service.currentUser()?.username).toBe('test@familia.com');
  });

  it('requires current PIN verification to change an already configured custom PIN', async () => {
    await service.setCustomPin('1423');

    const missingCurrent = await service.setCustomPin('5678');
    expect(missingCurrent.success).toBe(false);
    expect(missingCurrent.error).toContain('PIN actual');

    const wrongCurrent = await service.setCustomPin('5678', '9999');
    expect(wrongCurrent.success).toBe(false);
    expect(wrongCurrent.error).toContain('incorrecto');

    const validChange = await service.setCustomPin('5678', '1423');
    expect(validChange.success).toBe(true);

    const oldUnlock = await service.unlock('1423');
    expect(oldUnlock.success).toBe(false);

    const newUnlock = await service.unlock('5678');
    expect(newUnlock.success).toBe(true);
  });

  it('starts a 10-minute session after Phase 1 Supabase login and extends it on activity', async () => {
    expect(service.startAuthenticatedSession()).toBe(true);
    expect(service.isUnlocked()).toBe(true);
    expect(service.currentUser()?.username).toBe('test@familia.com');

    const initialExpiry = service.sessionExpiresAt();
    const futureNow = Date.now() + 5 * 60 * 1000;
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(futureNow);

    service.recordActivity();
    const updatedExpiry = service.sessionExpiresAt();
    expect(updatedExpiry).toBe(futureNow + INACTIVITY_TIMEOUT_MS);
    expect(updatedExpiry).toBeGreaterThan(initialExpiry);

    dateSpy.mockRestore();
  });

  it('refuses biometric or PIN unlock when Supabase session is not authenticated', async () => {
    await service.setCustomPin('1423');
    await supabaseAuth.signOut();

    expect(service.isUnlocked()).toBe(false);

    const pinRes = await service.unlock('1423');
    expect(pinRes.success).toBe(false);
    expect(pinRes.error).toContain('iniciar sesión');

    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const bioRes = await service.unlockWithBiometric();
    expect(bioRes.success).toBe(false);
    expect(bioRes.error).toContain('iniciar sesión');
  });

  it('locks the app when lock() is called', async () => {
    await service.setCustomPin('1423');
    await service.unlock('1423');
    expect(service.isUnlocked()).toBe(true);

    service.lock();
    expect(service.isUnlocked()).toBe(false);
  });

  it('triggers lockout after consecutive failed PIN attempts', async () => {
    await service.setCustomPin('1423');

    for (let i = 0; i < 5; i++) {
      await service.unlock('0000');
    }
    expect(service.isLockedOut()).toBe(true);
    expect(service.lockoutRemainingSecs()).toBeGreaterThan(0);

    const lockedRes = await service.unlock('1423');
    expect(lockedRes.success).toBe(false);
    expect(lockedRes.error).toContain('Acceso bloqueado');
  });
});
