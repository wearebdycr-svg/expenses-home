import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import type { ChartConfiguration, TooltipModel } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import {
  RESUMEN_COLORS,
  formatAxisCurrency,
  formatCOP,
} from '../../data/resumen.model';
import { ResumenService } from '../../data/resumen.service';

@Component({
  selector: 'app-resumen-bar-chart',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resumen-bar-chart.html',
  styleUrl: './resumen-bar-chart.css',
})
export class ResumenBarChart {
  protected readonly resumenService = inject(ResumenService);
  private readonly chartDirective = viewChild(BaseChartDirective);

  constructor() {
    effect(() => {
      this.data();
      const chartDir = this.chartDirective();
      if (chartDir) {
        chartDir.update();
      }
    });
  }

  protected readonly data = computed<ChartConfiguration<'bar'>['data']>(() => {
    const series = this.resumenService.barChartSeries();
    return {
      labels: [...series.labels],
      datasets: [
        {
          label: 'Ingresos',
          data: series.incomes,
          backgroundColor: RESUMEN_COLORS.income,
          borderRadius: 2,
          maxBarThickness: 16,
        },
        {
          label: 'Gastos',
          data: series.expenses,
          backgroundColor: RESUMEN_COLORS.expense,
          borderRadius: 2,
          maxBarThickness: 16,
        },
      ],
    };
  });

  protected readonly options: ChartConfiguration<'bar'>['options'] = {
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
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'rect',
          boxWidth: 10,
          boxHeight: 10,
          padding: 16,
          font: { size: 12 },
        },
      },
      tooltip: {
        enabled: false,
        external: (context) => this.customTooltipHandler(context),
      },
    },
  };

  private customTooltipHandler(context: { chart: any; tooltip: TooltipModel<'bar'> }): void {
    const { chart, tooltip } = context;
    const container = chart.canvas.parentNode as HTMLElement | null;
    if (!container) return;

    let tooltipEl = container.querySelector<HTMLDivElement>('.bar-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'bar-tooltip';
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
      const rowsHtml = tooltip.dataPoints
        .map((point) => {
          const val = point.parsed.y ?? 0;
          const label = point.dataset.label ?? '';
          const color = (point.dataset as any).backgroundColor ?? '#000';
          return `
            <div class="bar-tooltip-row">
              <span class="bar-tooltip-label" style="color: ${color}">${label}</span>
              <span class="bar-tooltip-val">${formatCOP(val)}</span>
            </div>
          `;
        })
        .join('');

      tooltipEl.innerHTML = `
        <div class="bar-tooltip-title">${monthLabel}</div>
        ${rowsHtml}
      `;
    }

    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = `${chart.canvas.offsetLeft + tooltip.caretX}px`;
    tooltipEl.style.top = `${chart.canvas.offsetTop + tooltip.caretY - 10}px`;
  }
}
