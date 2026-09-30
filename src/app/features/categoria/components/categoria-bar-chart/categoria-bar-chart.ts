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
import { formatAxisCurrencyK, formatCOP } from '../../data/categoria.model';
import { CategoriaService } from '../../data/categoria.service';

@Component({
  selector: 'app-categoria-bar-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categoria-bar-chart.html',
  styleUrl: './categoria-bar-chart.css',
})
export class CategoriaBarChart {
  protected readonly categoriaService = inject(CategoriaService);
  private readonly chartDirective = viewChild(BaseChartDirective);
  protected readonly rows = this.categoriaService.categoryRows;

  constructor() {
    effect(() => {
      this.data();
      const chartDir = this.chartDirective();
      if (chartDir) {
        queueMicrotask(() => {
          chartDir.render();
        });
      }
    });
  }

  protected readonly data = computed<ChartConfiguration<'bar'>['data']>(() => {
    const raw = this.categoriaService.stackedBarChartData();
    return {
      labels: [...raw.labels],
      datasets: raw.datasets,
    };
  });

  protected readonly options: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          callback: (value) => formatAxisCurrencyK(Number(value)),
          font: { size: 11 },
          color: '#64748b',
        },
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: {
          font: { size: 11 },
          color: '#64748b',
          autoSkip: false,
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

    let tooltipEl = container.querySelector<HTMLDivElement>('.stacked-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'stacked-tooltip';
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
      const catTitle = tooltip.title[0] ?? '';
      const rowsHtml = tooltip.dataPoints
        .map((point) => {
          const val = point.parsed.x ?? 0;
          const label = point.dataset.label ?? '';
          const color = (point.dataset as any).backgroundColor ?? '#000';
          return `
            <div class="stacked-tooltip-row">
              <span class="stacked-tooltip-label" style="color: ${color}">${label}</span>
              <span class="stacked-tooltip-val">${formatCOP(val)}</span>
            </div>
          `;
        })
        .join('');

      tooltipEl.innerHTML = `
        <div class="stacked-tooltip-title">${catTitle}</div>
        ${rowsHtml}
      `;
    }

    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = `${chart.canvas.offsetLeft + tooltip.caretX}px`;
    tooltipEl.style.top = `${chart.canvas.offsetTop + tooltip.caretY - 10}px`;
  }
}
