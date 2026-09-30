import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
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
}
