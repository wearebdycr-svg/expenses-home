import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar, type SidebarPageId } from './shared/ui/sidebar/sidebar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar],
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
