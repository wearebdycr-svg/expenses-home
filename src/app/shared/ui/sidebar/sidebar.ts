import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { ToastService } from '../../../core/services/toast.service';
import type { ExpensePerson } from '../../../features/gastos/data/expense.model';
import { Icon, type IconName } from '../icon/icon';

export type SidebarPageId = 'gastos' | 'ingresos' | 'resumen' | 'categoria' | 'deudas' | 'tc-compartida';

interface SidebarNavItem {
  id: SidebarPageId;
  label: string;
  description: string;
  icon: IconName;
}

interface SidebarPerson {
  name: string;
  color: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  currentPage = input<SidebarPageId>('gastos');
  navigate = output<SidebarPageId>();

  protected readonly pushService = inject(PushNotificationService);
  protected readonly toastService = inject(ToastService);
  protected readonly isProduction = environment.production;
  protected readonly mobileOpen = signal(false);
  protected readonly currentYear = new Date().getFullYear();

  protected readonly navItems: readonly SidebarNavItem[] = [
    { id: 'gastos', label: 'Gastos Diarios', description: 'Registro de egresos', icon: 'receipt' },
    { id: 'ingresos', label: 'Ingresos', description: 'Registro de entradas', icon: 'trending-up' },
    { id: 'resumen', label: 'Resumen Mensual', description: 'Balance por mes', icon: 'bar-chart-2' },
    { id: 'categoria', label: 'Por Categoría', description: 'Análisis de categorías', icon: 'pie-chart' },
    { id: 'deudas', label: 'Proyección Deudas', description: 'Pagos y proyecciones', icon: 'wallet' },
    { id: 'tc-compartida', label: 'TC Compartida', description: 'Consumos y saldo', icon: 'credit-card' },
  ];

  protected readonly people: readonly SidebarPerson[] = [
    { name: 'Benny', color: '#3B82F6' },
    { name: 'Charlie', color: '#F59E0B' },
    { name: 'Compartido', color: '#10B981' },
  ];

  protected openMobileMenu(): void {
    this.mobileOpen.set(true);
  }

  protected closeMobileMenu(): void {
    this.mobileOpen.set(false);
  }

  protected onNavItemClick(id: SidebarPageId): void {
    this.navigate.emit(id);
    this.closeMobileMenu();
  }

  protected onSubscribePush(): void {
    this.pushService.requestSubscription();
  }

  protected onTestPush(): void {
    this.pushService.sendTestNotification();
  }

  protected async onCopyToken(): Promise<void> {
    const token = this.pushService.currentToken();
    if (token) {
      try {
        await navigator.clipboard.writeText(token);
        this.toastService.success('Token copiado al portapapeles');
      } catch {
        this.toastService.info('Token listo en consola');
      }
    } else {
      this.toastService.warning('Aún no hay token registrado en este equipo');
    }
  }
}
