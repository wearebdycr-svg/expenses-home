import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CategoriaPage } from './features/categoria/categoria';
import { DeudasPage } from './features/deudas/deudas';
import { GastosPage } from './features/gastos/gastos';
import { IngresosPage } from './features/ingresos/ingresos';
import { ResumenPage } from './features/resumen/resumen';
import { Sidebar, type SidebarPageId } from './shared/ui/sidebar/sidebar';

@Component({
  selector: 'app-root',
  imports: [Sidebar, GastosPage, IngresosPage, ResumenPage, CategoriaPage, DeudasPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly currentPage = signal<SidebarPageId>('gastos');

  protected onNavigate(pageId: SidebarPageId): void {
    this.currentPage.set(pageId);
  }
}
