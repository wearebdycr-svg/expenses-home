import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { externalTooltipHandler } from '../../charts/chart-tooltip';
import { formatAxisCurrency } from '../../charts/chart-utils';
import { MONTH_ABBREVIATIONS, PERSON_COLORS, formatCOP } from '../../data/income.model';
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

  protected readonly title = computed(() => `Ingresos por mes — ${this.incomesService.year()}`);

  protected readonly data = computed<ChartConfiguration<'bar'>['data']>(() => {
    const series = this.incomesService.monthlySeries();
    return {
      labels: [...MONTH_ABBREVIATIONS],
      datasets: [
        {
          label: 'Ana',
          data: series.ana,
          backgroundColor: PERSON_COLORS.Ana,
          borderRadius: 4,
          maxBarThickness: 22,
        },
        {
          label: 'Carlos',
          data: series.carlos,
          backgroundColor: PERSON_COLORS.Carlos,
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
        external: externalTooltipHandler((tooltip) => ({
          title: tooltip.title[0] ?? '',
          rows: tooltip.dataPoints.map((point) => ({
            label: point.dataset.label ?? '',
            color: (point.dataset as { backgroundColor?: string }).backgroundColor ?? '#000',
            value: formatCOP(point.parsed.y),
          })),
        })),
      },
    },
  };
}
