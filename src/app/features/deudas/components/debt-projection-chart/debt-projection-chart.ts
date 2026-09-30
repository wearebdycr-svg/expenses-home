import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ChartConfiguration, TooltipModel } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { formatAxisCurrency, formatCOP } from '../../data/debt.model';
import { DebtsService } from '../../data/debts.service';

@Component({
  selector: 'app-debt-projection-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './debt-projection-chart.html',
  styleUrl: './debt-projection-chart.css',
})
export class DebtProjectionChart {
  protected readonly debtsService = inject(DebtsService);
  private readonly chartDirective = viewChild(BaseChartDirective);
  protected readonly debts = this.debtsService.filteredDebts;

  constructor() {
    effect(() => {
      this.data();
      const chartDir = this.chartDirective();
      if (chartDir) {
        chartDir.update();
      }
    });
  }

  protected readonly data = computed<ChartConfiguration<'line'>['data']>(() => {
    const raw = this.debtsService.projectionChartData();
    return {
      labels: [...raw.labels],
      datasets: raw.datasets,
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
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12,
        },
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8,
          padding: 16,
          font: { size: 11 },
        },
      },
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

    let tooltipEl = container.querySelector<HTMLDivElement>('.projection-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'projection-tooltip';
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
          const color = (point.dataset as any).borderColor ?? '#000';
          return `
            <div class="projection-tooltip-row">
              <span class="projection-tooltip-label" style="color: ${color}">${label}</span>
              <span class="projection-tooltip-val">${formatCOP(val)}</span>
            </div>
          `;
        })
        .join('');

      tooltipEl.innerHTML = `
        <div class="projection-tooltip-title">${monthLabel}</div>
        ${rowsHtml}
      `;
    }

    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = `${chart.canvas.offsetLeft + tooltip.caretX}px`;
    tooltipEl.style.top = `${chart.canvas.offsetTop + tooltip.caretY - 10}px`;
  }
}
