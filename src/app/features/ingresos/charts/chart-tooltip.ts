import type { Chart, TooltipModel } from 'chart.js';

export interface TooltipRow {
  label: string;
  color: string;
  value: string;
}

export interface TooltipContent {
  title: string;
  rows: readonly TooltipRow[];
  total?: string;
}

/**
 * Builds a Chart.js `plugins.tooltip.external` callback that renders a plain
 * HTML tooltip card matching the design in HU03-Gastos-3.png and HU02.
 */
export function externalTooltipHandler(buildContent: (tooltip: TooltipModel<any>) => TooltipContent) {
  return (context: { chart: Chart; tooltip: TooltipModel<any> }): void => {
    const { chart, tooltip } = context;
    const container = chart.canvas.parentNode as HTMLElement | null;
    if (!container) {
      return;
    }

    let tooltipEl = container.querySelector<HTMLDivElement>('.chartjs-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'chartjs-tooltip';
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
      const { title, rows, total } = buildContent(tooltip);
      const rowsHtml = rows
        .map(
          (row) => `
            <div class="chartjs-tooltip-row">
              <span class="chartjs-tooltip-label" style="color:${row.color}">${row.label}</span>
              <span class="chartjs-tooltip-value">${row.value}</span>
            </div>
          `,
        )
        .join('');

      tooltipEl.innerHTML = `
        <div class="chartjs-tooltip-title">${title}</div>
        ${rowsHtml}
        ${
          total
            ? `
          <div class="chartjs-tooltip-divider"></div>
          <div class="chartjs-tooltip-row chartjs-tooltip-total">
            <span class="chartjs-tooltip-label">Total</span>
            <span class="chartjs-tooltip-value">${total}</span>
          </div>
        `
            : ''
        }
      `;
    }

    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = `${chart.canvas.offsetLeft + tooltip.caretX}px`;
    tooltipEl.style.top = `${chart.canvas.offsetTop + tooltip.caretY - 10}px`;
  };
}
