import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { formatCOP } from '../../data/resumen.model';
import { ResumenService } from '../../data/resumen.service';

@Component({
  selector: 'app-resumen-kpis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resumen-kpis.html',
  styleUrl: './resumen-kpis.css',
})
export class ResumenKpis {
  protected readonly resumenService = inject(ResumenService);
  protected readonly formatCOP = formatCOP;

  protected formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }
}
