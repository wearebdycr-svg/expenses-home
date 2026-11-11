import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthLogin } from './auth-login';
import { AuthPinService } from '../../../core/services/auth-pin.service';
import { SupabaseAuthService } from '../../../core/services/supabase-auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

describe('AuthLogin', () => {
  let component: AuthLogin;
  let fixture: ComponentFixture<AuthLogin>;
  let supabaseAuth: SupabaseAuthService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AuthLogin],
      providers: [AuthPinService, SupabaseAuthService, SupabaseService],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthLogin);
    component = fixture.componentInstance;
    supabaseAuth = TestBed.inject(SupabaseAuthService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should validate empty or invalid email', async () => {
    component['email'].set('invalid-email');
    await component['onSubmit']();
    expect(component['errorMessage']()).toContain('correo electrónico válido');
  });

  it('should validate short password (< 6 chars)', async () => {
    component['email'].set('charlie@familia.com');
    component['password'].set('12345');
    await component['onSubmit']();
    expect(component['errorMessage']()).toContain('al menos 6 caracteres');
  });

  it('should call SupabaseAuthService.signInWithPassword and emit authenticated on success', async () => {
    const signInSpy = vi
      .spyOn(supabaseAuth, 'signInWithPassword')
      .mockResolvedValue({ error: null });

    let emitted = false;
    component.authenticated.subscribe(() => {
      emitted = true;
    });

    component['email'].set('charlie@familia.com');
    component['password'].set('claveSegura123');
    await component['onSubmit']();

    expect(signInSpy).toHaveBeenCalledWith('charlie@familia.com', 'claveSegura123');
    expect(emitted).toBe(true);
    expect(component['errorMessage']()).toBe('');
  });

  it('should show localized error when Supabase credentials are invalid', async () => {
    vi.spyOn(supabaseAuth, 'signInWithPassword').mockResolvedValue({
      error: new Error('Invalid login credentials'),
    });

    let emitted = false;
    component.authenticated.subscribe(() => {
      emitted = true;
    });

    component['email'].set('charlie@familia.com');
    component['password'].set('clave_incorrecta_123');
    await component['onSubmit']();

    expect(emitted).toBe(false);
    expect(component['errorMessage']()).toContain('Correo o contraseña incorrectos');
  });

  it('should show email confirmation message after signUp when session awaits verification', async () => {
    supabaseAuth.isAuthenticated.set(false);
    vi.spyOn(supabaseAuth, 'signUp').mockResolvedValue({
      error: null,
      user: { id: 'u-1', email: 'nuevo@familia.com' } as never,
    });

    component['toggleMode']();
    expect(component['isSignUpMode']()).toBe(true);

    component['email'].set('nuevo@familia.com');
    component['password'].set('secreta123');
    await component['onSubmit']();

    expect(component['successMessage']()).toContain('Revisa tu correo');
    expect(component['isSignUpMode']()).toBe(false);
  });

  it('should toggle password visibility', () => {
    expect(component['showPassword']()).toBe(false);
    component['toggleShowPassword']();
    expect(component['showPassword']()).toBe(true);
  });
});
