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
import { formatAxisCurrencyK, formatCOP } from '../../data/debt.model';
import { DebtsService } from '../../data/debts.service';

@Component({
  selector: 'app-debt-payments-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './debt-payments-chart.html',
  styleUrl: './debt-payments-chart.css',
})
export class DebtPaymentsChart {
  protected readonly debtsService = inject(DebtsService);
  private readonly chartDirective = viewChild(BaseChartDirective);
  protected readonly debts = this.debtsService.filteredDebts;

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
    const raw = this.debtsService.paymentsChartData();
    return {
      labels: [...raw.labels],
      datasets: raw.datasets,
    };
  });

  protected readonly options: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          callback: (value) => formatAxisCurrencyK(Number(value)),
          font: { size: 11 },
          color: '#64748b',
        },
      },
      y: {
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

  private customTooltipHandler(context: { chart: any; tooltip: TooltipModel<'bar'> }): void {
    const { chart, tooltip } = context;
    const container = chart.canvas.parentNode as HTMLElement | null;
    if (!container) return;

    let tooltipEl = container.querySelector<HTMLDivElement>('.payments-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'payments-tooltip';
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
      const debtTitle = tooltip.title[0] ?? '';
      const point = tooltip.dataPoints[0];
      const val = point.parsed.x ?? 0;

      // Estilo exacto a HU06-deudas-5.png: "Cuota mensual : $ 700.000"
      tooltipEl.innerHTML = `
        <div class="payments-tooltip-title">${debtTitle}</div>
        <div class="payments-tooltip-row">
          <span class="payments-tooltip-text">Cuota mensual : ${formatCOP(val)}</span>
        </div>
      `;
    }

    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = `${chart.canvas.offsetLeft + tooltip.caretX}px`;
    tooltipEl.style.top = `${chart.canvas.offsetTop + tooltip.caretY - 10}px`;
  }
}
