import type { Chart, TooltipModel } from 'chart.js';

export interface TooltipRow {
  label: string;
  color: string;
  value: string;
}

export interface TooltipContent {
  title: string;
  rows: readonly TooltipRow[];
}

/**
 * Builds a Chart.js `plugins.tooltip.external` callback that renders a plain
 * HTML tooltip (styled via the global `.chartjs-tooltip` rules in styles.css)
 * instead of the canvas-drawn default, matching the design's custom tooltip card.
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

    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = '0';
      return;
    }

    if (tooltip.dataPoints?.length) {
      const { title, rows } = buildContent(tooltip);
      tooltipEl.innerHTML = `
        <div class="chartjs-tooltip-title">${title}</div>
        ${rows
          .map(
            (row) => `
              <div class="chartjs-tooltip-row">
                <span class="chartjs-tooltip-label" style="color:${row.color}">${row.label}</span>
                <span class="chartjs-tooltip-value">${row.value}</span>
              </div>
            `,
          )
          .join('')}
      `;
    }

    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = `${chart.canvas.offsetLeft + tooltip.caretX}px`;
    tooltipEl.style.top = `${chart.canvas.offsetTop + tooltip.caretY}px`;
  };
}
