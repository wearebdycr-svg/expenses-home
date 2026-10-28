import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthLogin } from './auth-login';
import { AuthPinService } from '../../../core/services/auth-pin.service';
import { SupabaseService } from '../../../core/services/supabase.service';

describe('AuthLogin', () => {
  let component: AuthLogin;
  let fixture: ComponentFixture<AuthLogin>;
  let authPinService: AuthPinService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AuthLogin],
      providers: [AuthPinService, SupabaseService],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthLogin);
    component = fixture.componentInstance;
    authPinService = TestBed.inject(AuthPinService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should validate empty username and password', async () => {
    await component['onSubmit']();
    expect(component['errorMessage']()).toContain('usuario o correo');
  });

  it('should validate short password', async () => {
    component['username'].set('charlie');
    component['password'].set('12');
    await component['onSubmit']();
    expect(component['errorMessage']()).toContain('al menos 4 caracteres');
  });

  it('should emit authenticated event on successful login with pre-seeded user', async () => {
    let emitted = false;
    component.authenticated.subscribe(() => {
      emitted = true;
    });

    component['username'].set('charlie');
    component['password'].set('charlie2026');
    await component['onSubmit']();
    expect(emitted).toBe(true);
    expect(authPinService.isUnlocked()).toBe(true);
  });

  it('should show error when credentials are wrong', async () => {
    component['username'].set('charlie');
    component['password'].set('clave_incorrecta_123');
    await component['onSubmit']();
    expect(component['errorMessage']()).toContain('Contraseña incorrecta');
    expect(authPinService.isUnlocked()).toBe(false);
  });

  it('should toggle between sign-in and sign-up mode', () => {
    expect(component['isSignUpMode']()).toBe(false);
    component['toggleMode']();
    expect(component['isSignUpMode']()).toBe(true);
  });

  it('should toggle password visibility', () => {
    expect(component['showPassword']()).toBe(false);
    component['toggleShowPassword']();
    expect(component['showPassword']()).toBe(true);
  });

  it('should quickly fill account via fillQuickAccount', () => {
    component['fillQuickAccount']('benny', 'benny2026');
    expect(component['username']()).toBe('benny');
    expect(component['password']()).toBe('benny2026');
  });
});
