import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthLogin } from './auth-login';
import { SupabaseAuthService } from '../../../core/services/supabase-auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

describe('AuthLogin', () => {
  let component: AuthLogin;
  let fixture: ComponentFixture<AuthLogin>;
  let authService: SupabaseAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthLogin],
      providers: [SupabaseAuthService, SupabaseService],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthLogin);
    component = fixture.componentInstance;
    authService = TestBed.inject(SupabaseAuthService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should validate empty email and password', async () => {
    await component['onSubmit']();
    expect(component['errorMessage']()).toContain('correo electrónico válido');
  });

  it('should validate short password', async () => {
    component['email'].set('test@familia.com');
    component['password'].set('123');
    await component['onSubmit']();
    expect(component['errorMessage']()).toContain('al menos 6 caracteres');
  });

  it('should emit authenticated event on successful login', async () => {
    let emitted = false;
    component.authenticated.subscribe(() => {
      emitted = true;
    });

    component['email'].set('test@familia.com');
    component['password'].set('123456');
    await component['onSubmit']();
    expect(emitted).toBe(true);
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
});
