import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { App } from './app';
import { AuthPinService } from './core/services/auth-pin.service';
import { SupabaseAuthService } from './core/services/supabase-auth.service';

describe('App', () => {
  let authPinService: AuthPinService;
  let supabaseAuth: SupabaseAuthService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();

    supabaseAuth = TestBed.inject(SupabaseAuthService);
    authPinService = TestBed.inject(AuthPinService);
    // Por defecto desbloqueado para pruebas de navegación
    authPinService.isUnlocked.set(true);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('shows loading overlay while Supabase auth session is verifying', () => {
    supabaseAuth.isLoading.set(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.auth-loading-overlay')).toBeTruthy();
    expect(compiled.querySelector('app-auth-login')).toBeFalsy();
    expect(compiled.querySelector('app-pin-lock')).toBeFalsy();
    expect(compiled.querySelector('app-sidebar')).toBeFalsy();
  });

  it('loads directly into Phase 1 Supabase auth login on native app init when unauthenticated', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    supabaseAuth.isAuthenticated.set(false);
    authPinService.isUnlocked.set(false);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-splash-screen')).toBeFalsy();
    expect(compiled.querySelector('app-auth-login')).toBeTruthy();
    expect(compiled.querySelector('app-pin-lock')).toBeFalsy();
    expect(compiled.querySelector('app-sidebar')).toBeFalsy();
  });

  it('loads directly into Phase 1 Supabase auth login on web init when unauthenticated', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    supabaseAuth.isAuthenticated.set(false);
    authPinService.isUnlocked.set(false);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-splash-screen')).toBeFalsy();
    expect(compiled.querySelector('app-auth-login')).toBeTruthy();
    expect(compiled.querySelector('app-pin-lock')).toBeFalsy();
  });

  it('shows Phase 2 PIN lock when Supabase is authenticated but PIN session is locked', () => {
    supabaseAuth.isAuthenticated.set(true);
    authPinService.isUnlocked.set(false);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-auth-login')).toBeFalsy();
    expect(compiled.querySelector('app-pin-lock')).toBeTruthy();
    expect(compiled.querySelector('app-sidebar')).toBeFalsy();
  });

  it('loads directly into the app on refresh/init if the app is already unlocked without showing splash', () => {
    authPinService.isUnlocked.set(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-splash-screen')).toBeFalsy();
    expect(compiled.querySelector('app-sidebar')).toBeTruthy();
  });

  it('enters app immediately upon Phase 1 onSupabaseAuthenticated() and returns to login on signOut', async () => {
    supabaseAuth.isAuthenticated.set(false);
    authPinService.isUnlocked.set(false);
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-auth-login')).toBeTruthy();

    // Simular inicio de sesión Phase 1 exitoso en Supabase
    await supabaseAuth.signInWithPassword('charlie@familia.com', 'secreta123');
    app['onSupabaseAuthenticated']();
    fixture.detectChanges();

    expect(authPinService.isUnlocked()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-sidebar')).toBeTruthy();

    await app['onSignOutSupabase']();
    fixture.detectChanges();

    expect(supabaseAuth.isAuthenticated()).toBe(false);
    expect(authPinService.isUnlocked()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-auth-login')).toBeTruthy();
  });

  it('enters app immediately upon unlocking via onAppUnlocked() without splash delay', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    authPinService.isUnlocked.set(false);
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    // Usuario desbloquea PIN en Phase 2
    authPinService.isUnlocked.set(true);
    app['onAppUnlocked']();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-splash-screen')).toBeFalsy();
    expect(compiled.querySelector('app-sidebar')).toBeTruthy();
  });

  it('renders the sidebar when the app is unlocked', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-sidebar')).toBeTruthy();
  });

  it('updates currentPage when the sidebar navigates', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    const button = fixture.nativeElement.querySelectorAll('.nav-item')[1] as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(app['currentPage']()).toBe('ingresos');
  });

  it('navigates to resumen page and renders app-resumen-page', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    const resumenButton = fixture.nativeElement.querySelectorAll('.nav-item')[2] as HTMLButtonElement;
    resumenButton.click();
    fixture.detectChanges();

    expect(app['currentPage']()).toBe('resumen');
    expect(fixture.nativeElement.querySelector('app-resumen-page')).toBeTruthy();
  });

  it('navigates to categoria page and renders app-categoria-page', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    const categoriaButton = fixture.nativeElement.querySelectorAll('.nav-item')[3] as HTMLButtonElement;
    categoriaButton.click();
    fixture.detectChanges();

    expect(app['currentPage']()).toBe('categoria');
    expect(fixture.nativeElement.querySelector('app-categoria-page')).toBeTruthy();
  });

  it('navigates to gastos-fijos page and renders app-gastos-fijos-page', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    const fixedButton = fixture.nativeElement.querySelectorAll('.nav-item')[4] as HTMLButtonElement;
    fixedButton.click();
    fixture.detectChanges();

    expect(app['currentPage']()).toBe('gastos-fijos');
    expect(fixture.nativeElement.querySelector('app-gastos-fijos-page')).toBeTruthy();
  });

  it('navigates to deudas page and renders app-deudas-page', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    const deudasButton = fixture.nativeElement.querySelectorAll('.nav-item')[5] as HTMLButtonElement;
    deudasButton.click();
    fixture.detectChanges();

    expect(app['currentPage']()).toBe('deudas');
    expect(fixture.nativeElement.querySelector('app-deudas-page')).toBeTruthy();
  });

  it('navigates to tc-compartida page and renders app-tc-page', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    const tcButton = fixture.nativeElement.querySelectorAll('.nav-item')[6] as HTMLButtonElement;
    tcButton.click();
    fixture.detectChanges();

    expect(app['currentPage']()).toBe('tc-compartida');
    expect(fixture.nativeElement.querySelector('app-tc-page')).toBeTruthy();
  });

  it('saves selected page to localStorage and updates window.location.hash on navigation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    app['onNavigate']('deudas');
    fixture.detectChanges();

    expect(app['currentPage']()).toBe('deudas');
    expect(localStorage.getItem('expenses_home_active_page')).toBe('deudas');
    expect(window.location.hash).toBe('#deudas');
  });

  it('locks the app when onLockApp() is called', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    app['onLockApp']();
    fixture.detectChanges();

    expect(authPinService.isUnlocked()).toBe(false);
  });

  it('has setupBackButtonHandler configured for hardware navigation', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(typeof (app as any).setupBackButtonHandler).toBe('function');
  });

  it('opens and closes the fixed expenses quick modal', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    expect(fixture.nativeElement.querySelector('app-fixed-expenses-quick-modal')).toBeFalsy();

    const quickBtn = fixture.nativeElement.querySelector('.btn-visualize-fixed') as HTMLButtonElement;
    quickBtn.click();
    fixture.detectChanges();

    expect(app['showFixedExpensesQuickModal']()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-fixed-expenses-quick-modal')).toBeTruthy();

    app['closeFixedExpensesQuickModal']();
    fixture.detectChanges();

    expect(app['showFixedExpensesQuickModal']()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-fixed-expenses-quick-modal')).toBeFalsy();
  });
});
