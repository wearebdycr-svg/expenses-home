import { TestBed } from '@angular/core/testing';
import { AuthPinService, INACTIVITY_TIMEOUT_MS } from './auth-pin.service';

describe('AuthPinService', () => {
  let service: AuthPinService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthPinService);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('initializes in locked state when no session exists', () => {
    expect(service.isUnlocked()).toBe(false);
  });

  it('authenticates successfully with default credentials charlie / charlie2026', async () => {
    const res = await service.loginWithCredentials('charlie', 'charlie2026');
    expect(res.success).toBe(true);
    expect(service.isUnlocked()).toBe(true);
    expect(service.currentUser()?.username).toBe('charlie');
    expect(service.sessionExpiresAt()).toBeGreaterThan(Date.now());
  });

  it('authenticates successfully with default credentials benny / benny2026', async () => {
    const res = await service.loginWithCredentials('benny', 'benny2026');
    expect(res.success).toBe(true);
    expect(service.isUnlocked()).toBe(true);
    expect(service.currentUser()?.username).toBe('benny');
  });

  it('rejects invalid password for registered user', async () => {
    const res = await service.loginWithCredentials('charlie', 'wrongpassword');
    expect(res.success).toBe(false);
    expect(service.isUnlocked()).toBe(false);
    expect(res.error).toContain('Contraseña incorrecta');
  });

  it('allows registering a new user and logs them in immediately', async () => {
    const res = await service.registerUser('maria', 'segura123', 'María');
    expect(res.success).toBe(true);
    expect(service.isUnlocked()).toBe(true);
    expect(service.currentUser()?.name).toBe('María');

    // Logging out and logging back in
    service.logout();
    expect(service.isUnlocked()).toBe(false);

    const loginRes = await service.loginWithCredentials('maria', 'segura123');
    expect(loginRes.success).toBe(true);
    expect(service.isUnlocked()).toBe(true);
  });

  it('extends 10-minute session TTL when recordActivity() is called', async () => {
    await service.loginWithCredentials('charlie', 'charlie2026');
    const initialExpiry = service.sessionExpiresAt();

    // Advance 5 minutes
    const futureNow = Date.now() + 5 * 60 * 1000;
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(futureNow);

    service.recordActivity();
    const updatedExpiry = service.sessionExpiresAt();
    expect(updatedExpiry).toBe(futureNow + INACTIVITY_TIMEOUT_MS);
    expect(updatedExpiry).toBeGreaterThan(initialExpiry);

    dateSpy.mockRestore();
  });

  it('unlocks successfully with the default initial PIN (2026) for backward compatibility', async () => {
    const res = await service.unlock('2026', true);
    expect(res.success).toBe(true);
    expect(service.isUnlocked()).toBe(true);
  });

  it('rejects an incorrect PIN and reports error', async () => {
    const res = await service.unlock('9999', true);
    expect(res.success).toBe(false);
    expect(service.isUnlocked()).toBe(false);
    expect(res.error).toContain('PIN incorrecto');
  });

  it('locks the app when lock() is called', async () => {
    await service.unlock('2026', true);
    expect(service.isUnlocked()).toBe(true);

    service.lock();
    expect(service.isUnlocked()).toBe(false);
  });

  it('allows setting and using a new custom PIN', async () => {
    const setRes = await service.setCustomPin('1423');
    expect(setRes.success).toBe(true);
    expect(service.hasCustomPin()).toBe(true);

    // Old default PIN should now fail
    const oldRes = await service.unlock('2026');
    expect(oldRes.success).toBe(false);

    // New custom PIN should succeed
    const newRes = await service.unlock('1423');
    expect(newRes.success).toBe(true);
    expect(service.isUnlocked()).toBe(true);
  });

  it('triggers lockout after consecutive failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await service.unlock('0000');
    }
    expect(service.isLockedOut()).toBe(true);
    expect(service.lockoutRemainingSecs()).toBeGreaterThan(0);

    const lockedRes = await service.unlock('2026');
    expect(lockedRes.success).toBe(false);
    expect(lockedRes.error).toContain('Acceso bloqueado');
  });
});
