import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import type { ChartConfiguration, TooltipModel } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { formatCOP } from '../../data/categoria.model';
import { CategoriaService } from '../../data/categoria.service';

@Component({
  selector: 'app-categoria-donut-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categoria-donut-chart.html',
  styleUrl: './categoria-donut-chart.css',
})
export class CategoriaDonutChart {
  protected readonly categoriaService = inject(CategoriaService);
  protected readonly formatCOP = formatCOP;

  protected readonly legendItems = this.categoriaService.donutLegendItems;
  protected readonly total = this.categoriaService.totalPeriod;

  protected readonly data = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const raw = this.categoriaService.donutChartData();
    return {
      labels: [...raw.labels],
      datasets: raw.datasets,
    };
  });

  protected readonly options: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: (context) => this.customTooltipHandler(context),
      },
    },
  };

  private customTooltipHandler(context: { chart: any; tooltip: TooltipModel<'doughnut'> }): void {
    const { chart, tooltip } = context;
    const container = chart.canvas.parentNode as HTMLElement | null;
    if (!container) return;

    let tooltipEl = container.querySelector<HTMLDivElement>('.donut-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'donut-tooltip';
      container.appendChild(tooltipEl);
    }

    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      tooltipEl.style.opacity = '0';
      tooltipEl.style.display = 'none';
      return;
    }

    tooltipEl.style.display = 'block';

    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = '0';
      return;
    }

    if (tooltip.dataPoints?.length) {
      const point = tooltip.dataPoints[0];
      const categoryName = point.label ?? '';
      const val = point.parsed ?? 0;
      const totalAmount = this.total();
      const pct = totalAmount > 0 ? ((val / totalAmount) * 100).toFixed(1) : '0.0';

      tooltipEl.innerHTML = `
        <div class="donut-tooltip-title">${categoryName}</div>
        <div class="donut-tooltip-amount">${formatCOP(val)}</div>
        <div class="donut-tooltip-pct">${pct}% del total</div>
      `;
    }

    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = `${chart.canvas.offsetLeft + tooltip.caretX}px`;
    tooltipEl.style.top = `${chart.canvas.offsetTop + tooltip.caretY - 10}px`;
  }
}
