import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { IngresosPage } from './features/ingresos/ingresos';
import { Sidebar, type SidebarPageId } from './shared/ui/sidebar/sidebar';

@Component({
  selector: 'app-root',
  imports: [Sidebar, IngresosPage],
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
