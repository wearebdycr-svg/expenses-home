export function formatAxisCurrency(value: number): string {
  const millions = value / 1_000_000;
  return `$${millions.toFixed(1)}M`;
}
