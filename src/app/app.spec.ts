import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { App } from './app';
import { SupabaseAuthService } from './core/services/supabase-auth.service';

describe('App', () => {
  let supabaseAuth: SupabaseAuthService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();

    supabaseAuth = TestBed.inject(SupabaseAuthService);
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

  it('loads directly into Supabase email auth login on native app init when unauthenticated', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    supabaseAuth.isAuthenticated.set(false);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-splash-screen')).toBeFalsy();
    expect(compiled.querySelector('app-auth-login')).toBeTruthy();
    expect(compiled.querySelector('app-pin-lock')).toBeFalsy();
    expect(compiled.querySelector('app-sidebar')).toBeFalsy();
  });

  it('loads directly into Supabase email auth login on web init when unauthenticated', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    supabaseAuth.isAuthenticated.set(false);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-splash-screen')).toBeFalsy();
    expect(compiled.querySelector('app-auth-login')).toBeTruthy();
    expect(compiled.querySelector('app-pin-lock')).toBeFalsy();
  });

  it('loads directly into the app on refresh/init if the session is authenticated without showing PIN or splash', () => {
    supabaseAuth.isAuthenticated.set(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-splash-screen')).toBeFalsy();
    expect(compiled.querySelector('app-pin-lock')).toBeFalsy();
    expect(compiled.querySelector('app-sidebar')).toBeTruthy();
  });

  it('enters app immediately upon email signInWithPassword and returns to login on signOut', async () => {
    supabaseAuth.isAuthenticated.set(false);
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-auth-login')).toBeTruthy();

    await supabaseAuth.signInWithPassword('charlie@familia.com', 'secreta123');
    fixture.detectChanges();

    expect(supabaseAuth.isAuthenticated()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-pin-lock')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('app-sidebar')).toBeTruthy();

    await app['onSignOutSupabase']();
    fixture.detectChanges();

    expect(supabaseAuth.isAuthenticated()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-auth-login')).toBeTruthy();
  });

  it('renders the sidebar when authenticated', () => {
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
