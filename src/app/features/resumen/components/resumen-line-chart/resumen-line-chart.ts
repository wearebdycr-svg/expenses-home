import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { ChartConfiguration, TooltipModel } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { hexToRgba } from '../../../../shared/utils/color';
import {
  RESUMEN_COLORS,
  formatAxisCurrency,
  formatCOP,
} from '../../data/resumen.model';
import { ResumenService } from '../../data/resumen.service';

@Component({
  selector: 'app-resumen-line-chart',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resumen-line-chart.html',
  styleUrl: './resumen-line-chart.css',
})
export class ResumenLineChart {
  protected readonly resumenService = inject(ResumenService);

  protected readonly data = computed<ChartConfiguration<'line'>['data']>(() => {
    const series = this.resumenService.lineChartSeries();
    return {
      labels: [...series.labels],
      datasets: [
        {
          label: 'Saldo acumulado',
          data: series.cumulative,
          borderColor: RESUMEN_COLORS.savings,
          backgroundColor: hexToRgba(RESUMEN_COLORS.savings, 0.08),
          pointBackgroundColor: RESUMEN_COLORS.savings,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.35,
        },
      ],
    };
  });

  protected readonly options: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          callback: (value) => formatAxisCurrency(Number(value)),
          font: { size: 11 },
          color: '#64748b',
        },
      },
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 11 },
          color: '#64748b',
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: (context) => this.customTooltipHandler(context),
      },
    },
  };

  private customTooltipHandler(context: { chart: any; tooltip: TooltipModel<'line'> }): void {
    const { chart, tooltip } = context;
    const container = chart.canvas.parentNode as HTMLElement | null;
    if (!container) return;

    let tooltipEl = container.querySelector<HTMLDivElement>('.line-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'line-tooltip';
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
      const monthLabel = tooltip.title[0] ?? '';
      const point = tooltip.dataPoints[0];
      const val = point?.parsed?.y ?? 0;

      // Estilo exacto a HU04-resumen-mensual-3.png: "Saldo Acumulado : $ 31.500.399"
      tooltipEl.innerHTML = `
        <div class="line-tooltip-title">${monthLabel}</div>
        <div class="line-tooltip-row">
          <span class="line-tooltip-text">Saldo Acumulado : ${formatCOP(val)}</span>
        </div>
      `;
    }

    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = `${chart.canvas.offsetLeft + tooltip.caretX}px`;
    tooltipEl.style.top = `${chart.canvas.offsetTop + tooltip.caretY - 10}px`;
  }
}
