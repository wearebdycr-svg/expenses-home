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
import { formatCOP } from '../../data/expense.model';
import { ExpensesService } from '../../data/expenses.service';
import { escapeHtml } from '../../../../shared/utils/security.util';

@Component({
  selector: 'app-expense-category-chart',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expense-category-chart.html',
  styleUrl: './expense-category-chart.css',
})
export class ExpenseCategoryChart {
  protected readonly expensesService = inject(ExpensesService);
  private readonly chartDirective = viewChild(BaseChartDirective);

  protected readonly breakdown = this.expensesService.categoryBreakdown;

  constructor() {
    effect(() => {
      this.data();
      const chartDir = this.chartDirective();
      if (chartDir) {
        chartDir.update();
      }
    });
  }

  protected readonly hasData = computed(() => this.breakdown().length > 0);

  protected readonly data = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const items = this.breakdown();
    if (items.length === 0) {
      return {
        labels: ['Sin datos'],
        datasets: [
          {
            data: [1],
            backgroundColor: ['#e2e8f0'],
            borderWidth: 0,
          },
        ],
      };
    }

    return {
      labels: items.map((i) => i.category),
      datasets: [
        {
          data: items.map((i) => i.amount),
          backgroundColor: items.map((i) => i.color),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4,
        },
      ],
    };
  });

  protected readonly options: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        display: false, // Usamos la lista personalizada debajo que incluye porcentajes
      },
      tooltip: {
        enabled: false,
        external: (context) => this.customTooltipHandler(context),
      },
    },
  };

  private customTooltipHandler(context: { chart: any; tooltip: TooltipModel<'doughnut'> }): void {
    const { chart, tooltip } = context;
    const container = chart.canvas.parentNode as HTMLElement | null;
    if (!container || !this.hasData()) return;

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
      const category = point.label ?? '';
      const amount = Number(point.raw) || 0;

      // Estilo exacto a HU03-Gastos-4.png: "Hogar : $ 1.800.000"
      tooltipEl.innerHTML = `<span class="donut-tooltip-text">${escapeHtml(category)} : ${escapeHtml(formatCOP(amount))}</span>`;
    }

    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = `${chart.canvas.offsetLeft + tooltip.caretX}px`;
    tooltipEl.style.top = `${chart.canvas.offsetTop + tooltip.caretY - 10}px`;
  }
}
