import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Icon } from '../../../../shared/ui/icon/icon';
import { formatCOP } from '../../data/categoria.model';
import { CategoriaService } from '../../data/categoria.service';

@Component({
  selector: 'app-categoria-table',
  standalone: true,
  imports: [CommonModule, DecimalPipe, Icon],
  templateUrl: './categoria-table.html',
  styleUrl: './categoria-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriaTable {
  private readonly categoriaService = inject(CategoriaService);

  configureBudget = output<string>();

  readonly rows = this.categoriaService.categoryRows;
  readonly formatCOP = formatCOP;

  protected onConfigureBudget(category: string): void {
    this.configureBudget.emit(category);
  }
}
