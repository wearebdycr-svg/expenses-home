import { TestBed } from '@angular/core/testing';
import { AuthPinService } from './auth-pin.service';

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

  it('unlocks successfully with the default initial PIN (2026)', async () => {
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
