export type ResumenPerson = 'Todos' | 'Benny' | 'Charlie' | 'Compartido';

export interface MonthlySummaryRow {
  month: number; // 1 to 12
  monthName: string;
  monthAbbr: string;
  hasData: boolean;
  incomeBenny: number;
  incomeCharlie: number;
  totalIncome: number;
  expenseBenny: number;
  expenseCharlie: number;
  expenseCompartido: number;
  totalExpense: number;
  balance: number;
  cumulativeBalance: number;
  savingsRate: number; // Percentage, e.g. 56.5
  monthTotalIncome: number;
  monthTotalExpense: number;
  monthBalance: number;
  monthSavingsRate: number;
}

export interface ResumenKPIs {
  totalIncomeYTD: number;
  totalExpenseYTD: number;
  balanceYTD: number;
  averageIncomeMonthly: number;
  averageExpenseMonthly: number;
  savingsRateYTD: number;
  monthsWithDataCount: number;
}

const currentYear = new Date().getFullYear();
const startYear = Math.min(2025, currentYear - 1);
const endYear = Math.max(2026, currentYear + 1);

export const YEARS: readonly number[] = Array.from(
  { length: endYear - startYear + 1 },
  (_, i) => startYear + i,
);

export const MONTHS: readonly string[] = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const MONTH_ABBREVIATIONS: readonly string[] = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

export const RESUMEN_COLORS = {
  benny: '#3b82f6',
  charlie: '#f59e0b',
  compartido: '#10b981',
  income: '#10b981',
  expense: '#ef4444',
  balancePositive: '#10b981',
  balanceNegative: '#ef4444',
  savings: '#8b5cf6',
} as const;

export function formatCOP(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat('es-CO').format(Math.abs(rounded));
  return rounded < 0 ? `-$ ${formatted}` : `$ ${formatted}`;
}

export function formatAxisCurrency(value: number): string {
  if (value === 0) return '$0.0M';
  const millions = value / 1_000_000;
  return `$${millions.toFixed(1)}M`;
}
