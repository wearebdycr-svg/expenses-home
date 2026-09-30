import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import type { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { externalTooltipHandler } from '../../charts/chart-tooltip';
import { formatAxisCurrency } from '../../charts/chart-utils';
import { MONTHS, MONTH_ABBREVIATIONS, PERSON_COLORS, formatCOP } from '../../data/income.model';
import { IncomesService } from '../../data/incomes.service';

@Component({
  selector: 'app-income-bar-chart',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './income-bar-chart.html',
  styleUrl: './income-bar-chart.css',
})
export class IncomeBarChart {
  private readonly incomesService = inject(IncomesService);
  private readonly chartDirective = viewChild(BaseChartDirective);

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

  protected readonly title = computed(() => `Ingresos por mes — ${this.incomesService.year()}`);

  protected readonly data = computed<ChartConfiguration<'bar'>['data']>(() => {
    const series = this.incomesService.monthlySeries();
    return {
      labels: [...MONTH_ABBREVIATIONS],
      datasets: [
        {
          label: 'Benny',
          data: series.benny,
          backgroundColor: PERSON_COLORS.Benny,
          borderRadius: 4,
          maxBarThickness: 22,
        },
        {
          label: 'Charlie',
          data: series.charlie,
          backgroundColor: PERSON_COLORS.Charlie,
          borderRadius: 4,
          maxBarThickness: 22,
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
        grid: { color: '#eef2f7' },
        ticks: { callback: (value) => formatAxisCurrency(Number(value)) },
      },
      x: {
        grid: { display: false },
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 },
      },
      tooltip: {
        enabled: false,
        external: externalTooltipHandler((tooltip) => {
          const rawTitle = tooltip.title[0] ?? '';
          const monthIndex = MONTH_ABBREVIATIONS.indexOf(rawTitle as any);
          const fullMonthName = monthIndex >= 0 ? MONTHS[monthIndex] : rawTitle;
          let total = 0;
          const rows = tooltip.dataPoints.map((point) => {
            const val = point.parsed.y ?? 0;
            total += val;
            return {
              label: point.dataset.label ?? '',
              color: (point.dataset as { backgroundColor?: string }).backgroundColor ?? '#000',
              value: formatCOP(val),
            };
          });
          return {
            title: fullMonthName,
            rows,
            total: formatCOP(total),
          };
        }),
      },
    },
  };
}
