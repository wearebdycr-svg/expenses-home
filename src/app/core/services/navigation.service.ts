import {
  DestroyRef,
  inject,
  Injectable,
  signal,
  type WritableSignal,
} from '@angular/core';
import { App as CapApp } from '@capacitor/app';
import { TcService } from '../../features/tc-compartida/data/tc.service';
import { SupabaseAuthService } from './supabase-auth.service';
import type { SidebarPageId } from '../../shared/ui/sidebar/sidebar';

export const ACTIVE_PAGE_STORAGE_KEY: string = 'expenses_home_active_page';

export const VALID_SIDEBAR_PAGES: readonly SidebarPageId[] = [
  'gastos',
  'ingresos',
  'resumen',
  'categoria',
  'gastos-fijos',
  'deudas',
  'tc-compartida',
  'proyectos',
];

export function isValidSidebarPage(page: string | null | undefined): page is SidebarPageId {
  if (!page) {
    return false;
  }
  return (VALID_SIDEBAR_PAGES as readonly string[]).includes(page);
}

export function getInitialPage(): SidebarPageId {
  if (typeof window !== 'undefined') {
    // 1. Revisar URL hash primero (ej: #deudas, #resumen)
    const rawHash: string = window.location.hash.replace('#', '');
    if (isValidSidebarPage(rawHash)) {
      return rawHash;
    }
    // 2. Revisar localStorage
    try {
      const savedPage: string | null = localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);
      if (isValidSidebarPage(savedPage)) {
        return savedPage;
      }
    } catch {
      // Ignorar error de acceso a localStorage
    }
  }
  return 'gastos';
}

export type BackButtonCustomHandler = () => boolean;

export type BackButtonActionResult =
  | 'exit_app_unauthenticated'
  | 'custom_modal_closed'
  | 'generic_modal_closed'
  | 'sidebar_closed'
  | 'navigated_to_default'
  | 'exit_app_default';

export interface INavigationService {
  readonly currentPage: WritableSignal<SidebarPageId>;
  navigate(pageId: SidebarPageId): void;
  setupBackButtonHandler(customModalCloser?: BackButtonCustomHandler): void;
  exitApp(): Promise<void>;
  handleHardwareBackButton(): BackButtonActionResult;
}

@Injectable({
  providedIn: 'root',
})
export class NavigationService implements INavigationService {
  private readonly destroyRef: DestroyRef | null = inject(DestroyRef, { optional: true });
  private readonly tcService: TcService = inject(TcService);
  private readonly supabaseAuth: SupabaseAuthService = inject(SupabaseAuthService);

  readonly currentPage: WritableSignal<SidebarPageId> = signal<SidebarPageId>(getInitialPage());
  private customModalCloser: BackButtonCustomHandler | null = null;
  private isBackButtonListenerAttached: boolean = false;

  constructor() {
    this.initHashSync();
  }

  private initHashSync(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const current: SidebarPageId = this.currentPage();
    if (!window.location.hash && current !== 'gastos') {
      window.location.hash = current;
    }

    const onHashChange = (): void => {
      const rawHash: string = window.location.hash.replace('#', '');
      if (isValidSidebarPage(rawHash) && rawHash !== this.currentPage()) {
        this.currentPage.set(rawHash);
        if (rawHash === 'tc-compartida') {
          this.tcService.selectCard(null);
        }
        try {
          localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, rawHash);
        } catch {}
      }
    };

    window.addEventListener('hashchange', onHashChange);
    this.destroyRef?.onDestroy((): void => {
      window.removeEventListener('hashchange', onHashChange);
    });
  }

  navigate(pageId: SidebarPageId): void {
    if (pageId === 'tc-compartida') {
      this.tcService.selectCard(null);
    }
    this.currentPage.set(pageId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, pageId);
      } catch {}
      if (window.location.hash !== `#${pageId}`) {
        window.location.hash = pageId;
      }
    }
  }

  setupBackButtonHandler(customModalCloser?: BackButtonCustomHandler): void {
    if (customModalCloser) {
      this.customModalCloser = customModalCloser;
    }

    if (this.isBackButtonListenerAttached) {
      return;
    }

    try {
      CapApp.addListener('backButton', (): void => {
        this.handleHardwareBackButton();
      });
      this.isBackButtonListenerAttached = true;
    } catch {
      // Ignorar en entornos de prueba / web
    }
  }

  async exitApp(): Promise<void> {
    try {
      await CapApp.exitApp();
    } catch {
      // Entorno web / vitest
    }
  }

  handleHardwareBackButton(): BackButtonActionResult {
    // 1. Si no hay sesión autenticada activa, salir de la aplicación
    if (!this.supabaseAuth.isAuthenticated()) {
      void this.exitApp();
      return 'exit_app_unauthenticated';
    }

    // 2. Si hay algún modal abierto específico gestionado por interceptor, cerrarlo
    if (this.customModalCloser && this.customModalCloser()) {
      return 'custom_modal_closed';
    }

    // 3. Si hay algún modal abierto genérico con backdrop en el DOM, cerrarlo
    const modalCloseBtn: HTMLButtonElement | null = document.querySelector(
      '.modal-backdrop .modal-close, .modal-backdrop .btn-cancel',
    );
    if (modalCloseBtn) {
      modalCloseBtn.click();
      return 'generic_modal_closed';
    }

    // 4. Si el menú drawer móvil está abierto, cerrarlo
    const sidebarEl: Element | null = document.querySelector('.sidebar.is-open');
    const mobileCloseBtn: HTMLButtonElement | null = document.querySelector('.mobile-close-btn');
    if (sidebarEl && mobileCloseBtn) {
      mobileCloseBtn.click();
      return 'sidebar_closed';
    }

    // 5. Si estamos en una vista diferente al inicio (gastos), volver a gastos
    if (this.currentPage() !== 'gastos') {
      this.navigate('gastos');
      return 'navigated_to_default';
    }

    // 6. Si ya estamos en el inicio sin nada abierto, salir de la aplicación
    void this.exitApp();
    return 'exit_app_default';
  }
}
