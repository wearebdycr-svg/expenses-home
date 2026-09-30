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
import { Sidebar, type SidebarPageId } from './shared/ui/sidebar/sidebar';
import { DailyReminderBanner } from './shared/ui/daily-reminder-banner/daily-reminder-banner';
import { ToastContainer } from './shared/ui/toast-container/toast-container';

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
    ToastContainer,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly currentPage = signal<SidebarPageId>(getInitialPage());

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
          try {
            localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, hash);
          } catch {}
        }
      };

      window.addEventListener('hashchange', onHashChange);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('hashchange', onHashChange);
      });
    }
  }

  protected onNavigate(pageId: SidebarPageId): void {
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
