import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { ChartConfiguration, TooltipModel } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import {
  EXPENSE_PERSON_COLORS,
  MONTHS,
  formatCOP,
} from '../../data/expense.model';
import { ExpensesService } from '../../data/expenses.service';

function formatKCurrency(value: number): string {
  if (value === 0) return '$0k';
  return `$${Math.round(value / 1_000)}k`;
}

@Component({
  selector: 'app-expense-daily-chart',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expense-daily-chart.html',
  styleUrl: './expense-daily-chart.css',
})
export class ExpenseDailyChart {
  protected readonly expensesService = inject(ExpensesService);

  protected readonly title = computed(() => {
    const year = this.expensesService.year();
    const month = this.expensesService.month();
    if (month === 'Todos') {
      return `Gastos por día — ${year}`;
    }
    const monthName = MONTHS[Number(month) - 1] ?? '';
    return `Gastos por día — ${monthName} ${year}`;
  });

  protected readonly data = computed<ChartConfiguration<'bar'>['data']>(() => {
    const series = this.expensesService.dailySeries();
    return {
      labels: series.days.map(String),
      datasets: [
        {
          label: 'Benny',
          data: series.benny,
          backgroundColor: EXPENSE_PERSON_COLORS.Benny,
          borderRadius: 2,
          maxBarThickness: 16,
          stack: 'daily',
        },
        {
          label: 'Charlie',
          data: series.charlie,
          backgroundColor: EXPENSE_PERSON_COLORS.Charlie,
          borderRadius: 2,
          maxBarThickness: 16,
          stack: 'daily',
        },
        {
          label: 'Compartido',
          data: series.compartido,
          backgroundColor: EXPENSE_PERSON_COLORS.Compartido,
          borderRadius: 2,
          maxBarThickness: 16,
          stack: 'daily',
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
        stacked: true,
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          callback: (value) => formatKCurrency(Number(value)),
          font: { size: 11 },
          color: '#64748b',
        },
      },
      x: {
        stacked: true,
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

    let tooltipEl = container.querySelector<HTMLDivElement>('.daily-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'daily-tooltip';
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
      const dayLabel = tooltip.title[0] ?? '';
      let totalDay = 0;
      const rowsHtml = tooltip.dataPoints
        .map((point) => {
          const val = point.parsed.y ?? 0;
          totalDay += val;
          const label = point.dataset.label ?? '';
          const color = (point.dataset as any).backgroundColor ?? '#000';
          return `
            <div class="daily-tooltip-row">
              <span class="daily-tooltip-label" style="color: ${color}">${label}</span>
              <span class="daily-tooltip-val">${formatCOP(val)}</span>
            </div>
          `;
        })
        .join('');

      tooltipEl.innerHTML = `
        <div class="daily-tooltip-title">Día ${dayLabel}</div>
        ${rowsHtml}
        <div class="daily-tooltip-divider"></div>
        <div class="daily-tooltip-row daily-tooltip-total">
          <span class="daily-tooltip-label">Total</span>
          <span class="daily-tooltip-val">${formatCOP(totalDay)}</span>
        </div>
      `;
    }

    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = `${chart.canvas.offsetLeft + tooltip.caretX}px`;
    tooltipEl.style.top = `${chart.canvas.offsetTop + tooltip.caretY - 10}px`;
  }
}
