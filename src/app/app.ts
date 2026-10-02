import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { CategoriaPage } from './features/categoria/categoria';
import { DeudasPage } from './features/deudas/deudas';
import { GastosPage } from './features/gastos/gastos';
import { IngresosPage } from './features/ingresos/ingresos';
import { ResumenPage } from './features/resumen/resumen';
import { TcPage } from './features/tc-compartida/tc';
import { TcService } from './features/tc-compartida/data/tc.service';
import { Sidebar, type SidebarPageId } from './shared/ui/sidebar/sidebar';
import { DailyReminderBanner } from './shared/ui/daily-reminder-banner/daily-reminder-banner';
import { SplashScreen } from './shared/ui/splash-screen/splash-screen';
import { ToastContainer } from './shared/ui/toast-container/toast-container';
import { PinLock } from './shared/ui/pin-lock/pin-lock';
import { AuthPinService } from './core/services/auth-pin.service';
import { App as CapApp } from '@capacitor/app';

export const ACTIVE_PAGE_STORAGE_KEY = 'expenses_home_active_page';
export const VALID_SIDEBAR_PAGES: readonly SidebarPageId[] = [
  'gastos',
  'ingresos',
  'resumen',
  'categoria',
  'deudas',
  'tc-compartida',
];

function getInitialPage(): SidebarPageId {
  if (typeof window !== 'undefined') {
    // 1. Revisar URL hash primero (ej: #deudas, #resumen)
    const hash = window.location.hash.replace('#', '') as SidebarPageId;
    if (VALID_SIDEBAR_PAGES.includes(hash)) {
      return hash;
    }
    // 2. Revisar localStorage
    try {
      const saved = localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY) as SidebarPageId;
      if (saved && VALID_SIDEBAR_PAGES.includes(saved)) {
        return saved;
      }
    } catch {
      // Ignorar error de acceso a localStorage
    }
  }
  return 'gastos';
}

@Component({
  selector: 'app-root',
  imports: [
    Sidebar,
    GastosPage,
    IngresosPage,
    ResumenPage,
    CategoriaPage,
    DeudasPage,
    TcPage,
    DailyReminderBanner,
    SplashScreen,
    ToastContainer,
    PinLock,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly destroyRef = inject(DestroyRef);
  private readonly tcService = inject(TcService);
  protected readonly authPinService = inject(AuthPinService);
  protected readonly currentPage = signal<SidebarPageId>(getInitialPage());
  protected readonly showSplash = signal<boolean>(this.authPinService.isUnlocked());

  protected onSplashCompleted(): void {
    this.showSplash.set(false);
  }

  protected onLockApp(): void {
    this.authPinService.lock();
    this.showSplash.set(false);
  }

  protected onAppUnlocked(): void {
    this.showSplash.set(true);
  }

  constructor() {
    if (typeof window !== 'undefined') {
      // Sincronizar hash inicial si no existe y es diferente a gastos
      const current = this.currentPage();
      if (!window.location.hash && current !== 'gastos') {
        window.location.hash = current;
      }

      // Escuchar cambios de hash (navegación atrás/adelante del navegador)
      const onHashChange = () => {
        const hash = window.location.hash.replace('#', '') as SidebarPageId;
        if (VALID_SIDEBAR_PAGES.includes(hash) && hash !== this.currentPage()) {
          this.currentPage.set(hash);
          if (hash === 'tc-compartida') {
            this.tcService.selectCard(null);
          }
          try {
            localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, hash);
          } catch {}
        }
      };

      window.addEventListener('hashchange', onHashChange);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('hashchange', onHashChange);
      });

      this.setupBackButtonHandler();
    }
  }

  private setupBackButtonHandler(): void {
    try {
      CapApp.addListener('backButton', () => {
        // 1. Si la aplicación está bloqueada con PIN, salir de la aplicación
        if (!this.authPinService.isUnlocked()) {
          const changePinCloseBtn = document.querySelector(
            '.change-pin-modal .btn-close-modal, .change-pin-modal .btn-cancel',
          ) as HTMLButtonElement | null;
          if (changePinCloseBtn) {
            changePinCloseBtn.click();
            return;
          }
          CapApp.exitApp();
          return;
        }

        // 2. Si hay algún modal abierto en la aplicación, cerrarlo
        const modalCloseBtn = document.querySelector(
          '.modal-backdrop .modal-close, .modal-backdrop .btn-cancel',
        ) as HTMLButtonElement | null;
        if (modalCloseBtn) {
          modalCloseBtn.click();
          return;
        }

        // 3. Si el menú drawer móvil está abierto, cerrarlo
        const sidebarEl = document.querySelector('.sidebar.is-open');
        const mobileCloseBtn = document.querySelector('.mobile-close-btn') as HTMLButtonElement | null;
        if (sidebarEl && mobileCloseBtn) {
          mobileCloseBtn.click();
          return;
        }

        // 4. Si estamos en una vista diferente al inicio (gastos), volver a gastos
        if (this.currentPage() !== 'gastos') {
          this.onNavigate('gastos');
          return;
        }

        // 5. Si ya estamos en el inicio sin nada abierto, salir de la aplicación
        CapApp.exitApp();
      });
    } catch {
      // Ignorar en entornos de prueba
    }
  }

  protected onNavigate(pageId: SidebarPageId): void {
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
}
