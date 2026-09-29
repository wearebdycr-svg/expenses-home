import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { formatCOP } from '../../data/categoria.model';
import { CategoriaService } from '../../data/categoria.service';

@Component({
  selector: 'app-categoria-table',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './categoria-table.html',
  styleUrl: './categoria-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriaTable {
  private readonly categoriaService = inject(CategoriaService);

  readonly rows = this.categoriaService.categoryRows;
  readonly formatCOP = formatCOP;
}
