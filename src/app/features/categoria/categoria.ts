import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CategoriaBarChart } from './components/categoria-bar-chart/categoria-bar-chart';
import { CategoriaDonutChart } from './components/categoria-donut-chart/categoria-donut-chart';
import { CategoriaFilters } from './components/categoria-filters/categoria-filters';
import { CategoriaTable } from './components/categoria-table/categoria-table';

@Component({
  selector: 'app-categoria-page',
  standalone: true,
  imports: [
    CategoriaFilters,
    CategoriaDonutChart,
    CategoriaBarChart,
    CategoriaTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categoria.html',
  styleUrl: './categoria.css',
})
export class CategoriaPage {}
