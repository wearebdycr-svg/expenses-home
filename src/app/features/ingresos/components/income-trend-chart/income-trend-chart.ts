import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { hexToRgba } from '../../../../shared/utils/color';
import { externalTooltipHandler } from '../../charts/chart-tooltip';
import { formatAxisCurrency } from '../../charts/chart-utils';
import { MONTH_ABBREVIATIONS, TOTAL_COLOR, formatCOP } from '../../data/income.model';
import { IncomesService } from '../../data/incomes.service';

@Component({
  selector: 'app-income-trend-chart',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './income-trend-chart.html',
  styleUrl: './income-trend-chart.css',
})
export class IncomeTrendChart {
  private readonly incomesService = inject(IncomesService);

  protected readonly data = computed<ChartConfiguration<'line'>['data']>(() => ({
    labels: [...MONTH_ABBREVIATIONS],
    datasets: [
      {
        label: 'Total',
        data: this.incomesService.monthlySeries().total,
        borderColor: TOTAL_COLOR,
        backgroundColor: hexToRgba(TOTAL_COLOR, 0.12),
        pointBackgroundColor: TOTAL_COLOR,
        pointBorderColor: '#ffffff',
        pointRadius: 4,
        pointHoverRadius: 5,
        tension: 0.35,
        fill: true,
      },
    ],
  }));

  protected readonly options: ChartConfiguration<'line'>['options'] = {
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
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: externalTooltipHandler((tooltip) => ({
          title: tooltip.title[0] ?? '',
          rows: tooltip.dataPoints.map((point) => ({
            label: point.dataset.label ?? '',
            color: TOTAL_COLOR,
            value: formatCOP(point.parsed.y),
          })),
        })),
      },
    },
  };
}
