import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ResumenBarChart } from './components/resumen-bar-chart/resumen-bar-chart';
import { ResumenFilters } from './components/resumen-filters/resumen-filters';
import { ResumenKpis } from './components/resumen-kpis/resumen-kpis';
import { ResumenLineChart } from './components/resumen-line-chart/resumen-line-chart';
import { ResumenTable } from './components/resumen-table/resumen-table';

@Component({
  selector: 'app-resumen-page',
  standalone: true,
  imports: [
    ResumenFilters,
    ResumenKpis,
    ResumenBarChart,
    ResumenLineChart,
    ResumenTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resumen.html',
  styleUrl: './resumen.css',
})
export class ResumenPage {}
