import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CategoriaPage } from './features/categoria/categoria';
import { DeudasPage } from './features/deudas/deudas';
import { DebtsService } from './features/deudas/data/debts.service';
import { GastosPage } from './features/gastos/gastos';
import { ExpensesService } from './features/gastos/data/expenses.service';
import { IngresosPage } from './features/ingresos/ingresos';
import { IncomesService } from './features/ingresos/data/incomes.service';
import { ResumenPage } from './features/resumen/resumen';
import { ResumenService } from './features/resumen/data/resumen.service';
import { TcPage } from './features/tc-compartida/tc';
import { TcService } from './features/tc-compartida/data/tc.service';
import { ProyectosPage } from './features/proyectos/proyectos';
import { ProjectsService } from './features/proyectos/data/projects.service';
import { GastosFijosPage } from './features/gastos-fijos/gastos-fijos';
import { FixedExpensesService } from './features/gastos-fijos/data/fixed-expenses.service';
import { FixedExpensesQuickModal } from './features/gastos-fijos/components/fixed-expenses-quick-modal/fixed-expenses-quick-modal';
import { Sidebar, type SidebarPageId } from './shared/ui/sidebar/sidebar';
import { DailyReminderBanner } from './shared/ui/daily-reminder-banner/daily-reminder-banner';
import { ToastContainer } from './shared/ui/toast-container/toast-container';
import { AuthLogin } from './shared/ui/auth-login/auth-login';
import { RemoteConfigService } from './core/services/remote-config.service';
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
  private readonly expensesService = inject(ExpensesService);
  private readonly incomesService = inject(IncomesService);
  private readonly debtsService = inject(DebtsService);
  private readonly projectsService = inject(ProjectsService);
  private readonly fixedExpensesService = inject(FixedExpensesService);
  private readonly tcService = inject(TcService);
  private readonly remoteConfigService = inject(RemoteConfigService);
  private readonly resumenService = inject(ResumenService);
  protected readonly supabaseAuth = inject(SupabaseAuthService);
  protected readonly currentPage = this.navigationService.currentPage;
  protected readonly showFixedExpensesQuickModal = signal(false);

  constructor() {
    this.setupBackButtonHandler();

    let wasAuthenticated = this.supabaseAuth.isAuthenticated();
    effect(() => {
      const isAuth = this.supabaseAuth.isAuthenticated();
      if (!wasAuthenticated && isAuth) {
        this.refreshHouseholdData();
      }
      wasAuthenticated = isAuth;
    });
  }

  private refreshHouseholdData(): void {
    void this.expensesService.loadExpenses();
    void this.incomesService.loadIncomes();
    void this.debtsService.loadDebts();
    void this.projectsService.loadProjects();
    void this.projectsService.loadProjectExpenses();
    void this.fixedExpensesService.loadFixedExpenses();
    void this.tcService.loadCards();
    void this.tcService.loadTcExpenses();
    void this.remoteConfigService.loadBudgetsFromDb();
    void this.resumenService.loadFromView();
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

  protected async onSignOutSupabase(): Promise<void> {
    await this.supabaseAuth.signOut();
  }

  protected onNavigate(pageId: SidebarPageId): void {
    this.navigationService.navigate(pageId);
  }
}
