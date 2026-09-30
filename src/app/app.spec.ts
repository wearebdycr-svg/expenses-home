import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the sidebar', () => {
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

  it('navigates to deudas page and renders app-deudas-page', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    const deudasButton = fixture.nativeElement.querySelectorAll('.nav-item')[4] as HTMLButtonElement;
    deudasButton.click();
    fixture.detectChanges();

    expect(app['currentPage']()).toBe('deudas');
    expect(fixture.nativeElement.querySelector('app-deudas-page')).toBeTruthy();
  });

  it('navigates to tc-compartida page and renders app-tc-page', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    const tcButton = fixture.nativeElement.querySelectorAll('.nav-item')[5] as HTMLButtonElement;
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
});

