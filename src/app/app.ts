import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CategoriaPage } from './features/categoria/categoria';
import { DeudasPage } from './features/deudas/deudas';
import { GastosPage } from './features/gastos/gastos';
import { IngresosPage } from './features/ingresos/ingresos';
import { ResumenPage } from './features/resumen/resumen';
import { TcPage } from './features/tc-compartida/tc';
import { ProyectosPage } from './features/proyectos/proyectos';
import { GastosFijosPage } from './features/gastos-fijos/gastos-fijos';
import { FixedExpensesQuickModal } from './features/gastos-fijos/components/fixed-expenses-quick-modal/fixed-expenses-quick-modal';
import { Sidebar, type SidebarPageId } from './shared/ui/sidebar/sidebar';
import { DailyReminderBanner } from './shared/ui/daily-reminder-banner/daily-reminder-banner';
import { ToastContainer } from './shared/ui/toast-container/toast-container';
import { AuthLogin } from './shared/ui/auth-login/auth-login';
import { AuthPinService } from './core/services/auth-pin.service';
import { SupabaseAuthService } from './core/services/supabase-auth.service';
import { PushNotificationService } from './core/services/push-notification.service';
import {
  NavigationService,
  ACTIVE_PAGE_STORAGE_KEY,
  VALID_SIDEBAR_PAGES,
} from './core/services/navigation.service';

export { ACTIVE_PAGE_STORAGE_KEY, VALID_SIDEBAR_PAGES };

@Component({
  selector: 'app-root',
  imports: [
    Sidebar,
    GastosPage,
    IngresosPage,
    ResumenPage,
    CategoriaPage,
    GastosFijosPage,
    FixedExpensesQuickModal,
    DeudasPage,
    TcPage,
    ProyectosPage,
    DailyReminderBanner,
    ToastContainer,
    AuthLogin,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly navigationService = inject(NavigationService);
  private readonly pushNotificationService = inject(PushNotificationService);
  protected readonly authPinService = inject(AuthPinService);
  protected readonly supabaseAuth = inject(SupabaseAuthService);
  protected readonly currentPage = this.navigationService.currentPage;
  protected readonly showFixedExpensesQuickModal = signal(false);

  constructor() {
    this.setupBackButtonHandler();
  }

  protected setupBackButtonHandler(): void {
    this.navigationService.setupBackButtonHandler(() => {
      if (this.showFixedExpensesQuickModal()) {
        this.closeFixedExpensesQuickModal();
        return true;
      }
      return false;
    });
  }

  protected openFixedExpensesQuickModal(): void {
    this.showFixedExpensesQuickModal.set(true);
  }

  protected closeFixedExpensesQuickModal(): void {
    this.showFixedExpensesQuickModal.set(false);
  }

  protected onGoToFixedExpensesSection(): void {
    this.showFixedExpensesQuickModal.set(false);
    this.onNavigate('gastos-fijos');
  }

  protected onLockApp(): void {
    this.authPinService.lock();
  }

  protected onAppUnlocked(): void {
    // Desbloqueo instantáneo sin splash screen ni retardos
  }

  protected onSupabaseAuthenticated(): void {
    // Tras autenticarse en Supabase, el flujo sigue al PIN o vista principal de inmediato
  }

  protected async onSignOutSupabase(): Promise<void> {
    await this.supabaseAuth.signOut();
    this.authPinService.lock();
  }

  protected onNavigate(pageId: SidebarPageId): void {
    this.navigationService.navigate(pageId);
  }
}
