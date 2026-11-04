import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  NavigationService,
  ACTIVE_PAGE_STORAGE_KEY,
  VALID_SIDEBAR_PAGES,
  getInitialPage,
  isValidSidebarPage,
  type BackButtonActionResult,
} from './navigation.service';
import { AuthPinService } from './auth-pin.service';
import { TcService } from '../../features/tc-compartida/data/tc.service';

describe('NavigationService', () => {
  let service: NavigationService;
  let authPinService: AuthPinService;
  let tcService: TcService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = '';

    TestBed.configureTestingModule({
      providers: [NavigationService],
    });

    service = TestBed.inject(NavigationService);
    authPinService = TestBed.inject(AuthPinService);
    tcService = TestBed.inject(TcService);

    // Por defecto desbloqueado
    authPinService.isUnlocked.set(true);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = '';
    vi.restoreAllMocks();
  });

  it('debe crearse e inicializar la página inicial en gastos por defecto', () => {
    expect(service).toBeTruthy();
    expect(service.currentPage()).toBe('gastos');
  });

  describe('isValidSidebarPage', () => {
    it('debe retornar true para páginas válidas definidas en VALID_SIDEBAR_PAGES', () => {
      for (const page of VALID_SIDEBAR_PAGES) {
        expect(isValidSidebarPage(page)).toBe(true);
      }
    });

    it('debe retornar false para valores null, undefined o cadenas inválidas', () => {
      expect(isValidSidebarPage(null)).toBe(false);
      expect(isValidSidebarPage(undefined)).toBe(false);
      expect(isValidSidebarPage('')).toBe(false);
      expect(isValidSidebarPage('pagina-inexistente')).toBe(false);
    });
  });

  describe('getInitialPage', () => {
    it('debe leer la página desde el hash de la URL si es válido', () => {
      window.location.hash = '#deudas';
      expect(getInitialPage()).toBe('deudas');
    });

    it('debe leer la página desde localStorage si el hash no es válido', () => {
      window.location.hash = '';
      localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, 'resumen');
      expect(getInitialPage()).toBe('resumen');
    });

    it('debe retornar gastos si ni el hash ni localStorage tienen un valor válido', () => {
      window.location.hash = '#invalido';
      localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, 'otra-cosa');
      expect(getInitialPage()).toBe('gastos');
    });
  });

  describe('navigate', () => {
    it('debe actualizar currentPage, localStorage y window.location.hash', () => {
      service.navigate('ingresos');

      expect(service.currentPage()).toBe('ingresos');
      expect(localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY)).toBe('ingresos');
      expect(window.location.hash).toBe('#ingresos');
    });

    it('debe deseleccionar tarjeta al navegar a tc-compartida', () => {
      const selectCardSpy = vi.spyOn(tcService, 'selectCard');

      service.navigate('tc-compartida');

      expect(service.currentPage()).toBe('tc-compartida');
      expect(selectCardSpy).toHaveBeenCalledWith(null);
    });
  });

  describe('handleHardwareBackButton', () => {
    it('debe llamar a exitApp y retornar exit_app_locked si la aplicación está bloqueada', () => {
      authPinService.isUnlocked.set(false);
      const exitSpy = vi.spyOn(service, 'exitApp').mockImplementation(async () => {});

      const result: BackButtonActionResult = service.handleHardwareBackButton();

      expect(exitSpy).toHaveBeenCalled();
      expect(result).toBe('exit_app_locked');
    });

    it('debe cerrar change-pin-modal y retornar pin_lock_modal_closed si la app está bloqueada pero el modal de PIN está abierto', () => {
      authPinService.isUnlocked.set(false);
      const exitSpy = vi.spyOn(service, 'exitApp').mockImplementation(async () => {});

      const modalContainer = document.createElement('div');
      modalContainer.className = 'change-pin-modal';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn-close-modal';
      const clickSpy = vi.spyOn(closeBtn, 'click');
      modalContainer.appendChild(closeBtn);
      document.body.appendChild(modalContainer);

      try {
        const result: BackButtonActionResult = service.handleHardwareBackButton();
        expect(clickSpy).toHaveBeenCalled();
        expect(exitSpy).not.toHaveBeenCalled();
        expect(result).toBe('pin_lock_modal_closed');
      } finally {
        document.body.removeChild(modalContainer);
      }
    });

    it('debe delegar a customModalCloser y retornar custom_modal_closed si está registrado y retorna true', () => {
      const customCloser = vi.fn().mockReturnValue(true);
      service.setupBackButtonHandler(customCloser);

      const result: BackButtonActionResult = service.handleHardwareBackButton();

      expect(customCloser).toHaveBeenCalled();
      expect(result).toBe('custom_modal_closed');
    });

    it('debe cerrar modales estándar con backdrop y retornar generic_modal_closed si están presentes', () => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'modal-close';
      const clickSpy = vi.spyOn(closeBtn, 'click');
      backdrop.appendChild(closeBtn);
      document.body.appendChild(backdrop);

      try {
        const result: BackButtonActionResult = service.handleHardwareBackButton();
        expect(clickSpy).toHaveBeenCalled();
        expect(result).toBe('generic_modal_closed');
      } finally {
        document.body.removeChild(backdrop);
      }
    });

    it('debe cerrar el sidebar móvil y retornar sidebar_closed si está abierto', () => {
      const sidebar = document.createElement('div');
      sidebar.className = 'sidebar is-open';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'mobile-close-btn';
      const clickSpy = vi.spyOn(closeBtn, 'click');
      document.body.appendChild(sidebar);
      document.body.appendChild(closeBtn);

      try {
        const result: BackButtonActionResult = service.handleHardwareBackButton();
        expect(clickSpy).toHaveBeenCalled();
        expect(result).toBe('sidebar_closed');
      } finally {
        document.body.removeChild(sidebar);
        document.body.removeChild(closeBtn);
      }
    });

    it('debe navegar a gastos y retornar navigated_to_default si estamos en otra vista sin modales abiertos', () => {
      service.navigate('categoria');
      expect(service.currentPage()).toBe('categoria');

      const result: BackButtonActionResult = service.handleHardwareBackButton();

      expect(service.currentPage()).toBe('gastos');
      expect(result).toBe('navigated_to_default');
    });

    it('debe salir de la aplicación y retornar exit_app_default si estamos en gastos y no hay nada abierto', () => {
      service.navigate('gastos');
      const exitSpy = vi.spyOn(service, 'exitApp').mockImplementation(async () => {});

      const result: BackButtonActionResult = service.handleHardwareBackButton();

      expect(exitSpy).toHaveBeenCalled();
      expect(result).toBe('exit_app_default');
    });
  });
});
