import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  let fixture: ComponentFixture<Sidebar>;
  let component: Sidebar;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sidebar],
    }).compileComponents();

    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function navItems(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.nav-item'));
  }

  it('marks the item matching currentPage as active', () => {
    fixture.componentRef.setInput('currentPage', 'gastos');
    fixture.detectChanges();

    const [gastos, ingresos] = navItems();
    expect(gastos.classList.contains('is-active')).toBe(true);
    expect(ingresos.classList.contains('is-active')).toBe(false);
  });

  it('switches the active item when a different page is set', () => {
    fixture.componentRef.setInput('currentPage', 'ingresos');
    fixture.detectChanges();

    const [gastos, ingresos] = navItems();
    expect(gastos.classList.contains('is-active')).toBe(false);
    expect(ingresos.classList.contains('is-active')).toBe(true);
  });

  it('emits navigate with the clicked item id', () => {
    const spy = vi.fn();
    component.navigate.subscribe(spy);

    navItems()[1].click();

    expect(spy).toHaveBeenCalledWith('ingresos');
  });

  it('opens the mobile drawer when the floating menu button is clicked', () => {
    const menuBtn = fixture.nativeElement.querySelector('.mobile-menu-btn') as HTMLButtonElement;
    menuBtn.click();
    fixture.detectChanges();

    expect(component['mobileOpen']()).toBe(true);
    expect(fixture.nativeElement.querySelector('.sidebar').classList.contains('is-open')).toBe(true);
  });

  it('closes the mobile drawer when the close button is clicked', () => {
    component['mobileOpen'].set(true);
    fixture.detectChanges();

    const closeBtn = fixture.nativeElement.querySelector('.mobile-close-btn') as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();

    expect(component['mobileOpen']()).toBe(false);
  });

  it('closes the mobile drawer when clicking the overlay', () => {
    component['mobileOpen'].set(true);
    fixture.detectChanges();

    const overlay = fixture.nativeElement.querySelector('.sidebar-overlay') as HTMLElement;
    overlay.click();
    fixture.detectChanges();

    expect(component['mobileOpen']()).toBe(false);
  });

  it('closes the mobile drawer and emits navigate when a nav item is clicked', () => {
    component['mobileOpen'].set(true);
    fixture.detectChanges();
    const spy = vi.fn();
    component.navigate.subscribe(spy);

    navItems()[2].click();
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith('resumen');
    expect(component['mobileOpen']()).toBe(false);
  });
});
