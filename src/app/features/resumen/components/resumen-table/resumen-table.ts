import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ResumenService } from '../../data/resumen.service';
import { formatCOP } from '../../data/resumen.model';

@Component({
  selector: 'app-resumen-table',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './resumen-table.html',
  styleUrl: './resumen-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumenTable {
  private readonly resumenService = inject(ResumenService);

  readonly year = this.resumenService.year;
  readonly rows = this.resumenService.summaryRows;

  readonly formatCOP = formatCOP;
}
