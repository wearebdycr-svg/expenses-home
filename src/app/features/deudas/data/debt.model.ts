import type { ExpensePerson } from '../../gastos/data/expense.model';

export type DebtPerson = ExpensePerson;
export type DebtPersonFilter = 'Todos' | ExpensePerson;
export type DebtStatus = 'activa' | 'saldada';

export interface Debt {
  id: string;
  name: string;
  person: DebtPerson;
  startDate: string; // yyyy-MM-dd
  originalAmount: number;
  currentBalance: number;
  monthlyPayment: number;
  annualInterestRate: number; // e.g. 8.5, 10.2, 24.0
  totalMonths?: number; // Número de meses (plazo total del crédito)
  color: string;
  status?: DebtStatus;
  totalAmortized?: number;
}

export type DebtDraft = Omit<Debt, 'id' | 'color'>;

export interface PrepaymentDraft {
  debtId: string;
  amount: number;
  date: string;
}

export interface AmortizationResult {
  remainingMonths: number;
  projectedEndDate: Date;
  projectedDateFormatted: string; // e.g. "Enero 2039"
  monthly36Series: number[]; // 37 values (month 0 to month 36)
}

export const DEBT_PALETTE = [
  '#3b82f6', // Azul (Hipoteca)
  '#f59e0b', // Naranja (Vehículo)
  '#ef4444', // Rojo (Tarjeta de crédito)
  '#10b981', // Verde (Préstamo personal)
  '#8b5cf6', // Púrpura
  '#ec4899', // Rosa
  '#06b6d4', // Cyan
  '#f97316', // Coral
];

export function formatCOP(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rounded < 0 ? `-$ ${formatted}` : `$ ${formatted}`;
}

export function formatAxisCurrency(value: number): string {
  if (value === 0) return '$0.0M';
  const millions = value / 1_000_000;
  return `$${millions.toFixed(1)}M`;
}

export function formatAxisCurrencyK(value: number): string {
  if (value === 0) return '$0k';
  const thousands = Math.round(value / 1000);
  return `$${thousands}k`;
}

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  month: 'long',
  year: 'numeric',
});

export function formatMonthYear(date: Date): string {
  const str = MONTH_YEAR_FORMATTER.format(date);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Genera la etiqueta mes/año corta para los 36 meses del gráfico (ej: "Jul 26", "Feb 27")
 */
export function generate36MonthLabels(baseDate: Date = new Date()): string[] {
  const labels: string[] = [];
  const formatter = new Intl.DateTimeFormat('es-CO', {
    month: 'short',
    year: '2-digit',
  });

  for (let i = 0; i <= 36; i++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
    const formatted = formatter.format(d).replace('.', '');
    labels.push(formatted.charAt(0).toUpperCase() + formatted.slice(1));
  }
  return labels;
}

/**
 * Algoritmo de Amortización Francesa y cálculo de meses restantes (Criterio 70-77)
 */
export function calculateAmortization(
  debt: Pick<Debt, 'currentBalance' | 'monthlyPayment' | 'annualInterestRate'> & {
    totalMonths?: number;
    originalAmount?: number;
  },
  baseDate: Date = new Date(),
): AmortizationResult {
  // 1. Si la deuda está saldada o saldo <= 0
  if (debt.currentBalance <= 0) {
    return {
      remainingMonths: 0,
      projectedEndDate: baseDate,
      projectedDateFormatted: 'Liquidada',
      monthly36Series: Array(37).fill(0),
    };
  }

  // 2. Si tiene definido totalMonths (número de meses pactado para el crédito):
  // Los meses restantes se calculan en base al saldo pendiente y la cuota pactada.
  if (debt.totalMonths && debt.totalMonths > 0) {
    let remainingMonths: number;
    if (debt.monthlyPayment > 0) {
      remainingMonths = Math.ceil(debt.currentBalance / debt.monthlyPayment);
      remainingMonths = Math.min(debt.totalMonths, remainingMonths);
    } else {
      remainingMonths = debt.totalMonths;
    }
    remainingMonths = Math.max(0, remainingMonths);

    const projectedEndDate = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth() + remainingMonths,
      1,
    );

    const monthly36Series: number[] = [];
    let s = debt.currentBalance;
    const monthlyStep =
      debt.monthlyPayment > 0
        ? debt.monthlyPayment
        : debt.currentBalance / debt.totalMonths;

    for (let i = 0; i <= 36; i++) {
      monthly36Series.push(Math.round(s));
      s = Math.max(0, s - monthlyStep);
    }

    return {
      remainingMonths,
      projectedEndDate,
      projectedDateFormatted: formatMonthYear(projectedEndDate),
      monthly36Series: monthly36Series.slice(0, 37),
    };
  }

  // 3. Algoritmo de Amortización Francesa clásico (para deudas históricas sin totalMonths)
  const r = debt.annualInterestRate / (12 * 100);
  let s = debt.currentBalance;
  let months = 0;

  // Serie para los 36 meses (mes 0 = saldo actual)
  const monthly36Series: number[] = [s];

  while (s > 0 && months < 600) {
    months++;
    const interest = s * r;
    const amortization = debt.monthlyPayment - interest;

    if (amortization <= 0) {
      // Si la cuota no cubre ni los intereses, el saldo no decrece
      break;
    }

    s = Math.max(0, s - amortization);

    if (months <= 36) {
      monthly36Series.push(Math.round(s));
    }
  }

  // Si se amortizó antes del mes 36, rellenar los meses restantes con 0
  while (monthly36Series.length <= 37) {
    monthly36Series.push(0);
  }

  const projectedEndDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + months,
    1,
  );

  return {
    remainingMonths: months,
    projectedEndDate,
    projectedDateFormatted: formatMonthYear(projectedEndDate),
    monthly36Series: monthly36Series.slice(0, 37),
  };
}

export function generateDebtId(): string {
  return `debt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
