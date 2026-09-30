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
  paidMonths?: number;
  paidInstallmentsCount?: number;
}

export type DebtDraft = Omit<Debt, 'id' | 'color'>;

export interface PrepaymentDraft {
  debtId: string;
  amount: number;
  date: string;
}

export interface AmortizationResult {
  paidMonths: number;
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
 * Conversión de Tasa Anual a Tasa Periódica Mensual (i_m):
 * - Tasa Efectiva Anual (E.A.): i_m = (1 + EA)^(1/12) - 1
 * - Tasa Anual Nominal (M.V.): i_m = Tasa Anual / (12 * 100)
 */
export function calculateMonthlyRate(annualRate: number, isNominal: boolean = false): number {
  if (annualRate <= 0) return 0;
  if (isNominal) {
    return annualRate / (12 * 100);
  }
  return Math.pow(1 + annualRate / 100, 1 / 12) - 1;
}

/**
 * Cálculo de la Cuota Mensual Fija (C) — Amortización Francesa:
 * C = P * [ (i_m * (1 + i_m)^n) / ((1 + i_m)^n - 1) ]
 * Si i_m == 0: C = P / n
 */
export function calculateMonthlyPayment(
  originalAmount: number,
  totalMonths: number,
  annualInterestRate: number,
  isNominal: boolean = false,
): number {
  if (originalAmount <= 0 || totalMonths <= 0) return 0;
  const im = calculateMonthlyRate(annualInterestRate, isNominal);
  if (im <= 0) {
    return Math.round(originalAmount / totalMonths);
  }
  const factor = Math.pow(1 + im, totalMonths);
  const payment = (originalAmount * (im * factor)) / (factor - 1);
  return Math.round(payment);
}

/**
 * Diferencia en meses entre fecha inicio y fecha de evaluación
 */
export function differenceInMonths(startDateStr: string, currentDate: Date = new Date()): number {
  if (!startDateStr) return 0;
  const parts = startDateStr.split('-').map(Number);
  if (parts.length < 2 || !parts[0] || !parts[1]) return 0;
  const start = new Date(parts[0], parts[1] - 1, parts[2] || 1);
  const diffYears = currentDate.getFullYear() - start.getFullYear();
  const diffMonths = currentDate.getMonth() - start.getMonth();
  return Math.max(0, diffYears * 12 + diffMonths);
}

/**
 * Redondeo preciso de meses que neutraliza artefactos de punto flotante
 * (ej: 11.0000048 -> 11) respetando cuotas fraccionarias reales (ej: 11.2 -> 12).
 */
function cleanMonths(raw: number): number {
  if (Math.abs(raw - Math.round(raw)) < 0.02) {
    return Math.round(raw);
  }
  return Math.ceil(raw);
}

/**
 * Algoritmo de Cálculo de Cuotas Pagadas y Meses Restantes (n_restantes):
 * Dada la cuota fija C, saldo actual S y tasa periódica i_m:
 * n_restantes = cleanMonths( -ln(1 - (S * i_m) / C) / ln(1 + i_m) )
 */
export function calculateRemainingMonths(
  balance: number,
  monthlyPayment: number,
  annualInterestRate: number,
  totalMonths?: number,
  paidInstallmentsCount: number = 0,
  isNominal: boolean = false,
): number {
  if (balance <= 100) return 0;

  // 1. Si el crédito tiene un plazo total pactado (totalMonths) y se han registrado cuotas pagadas:
  // Los meses restantes corresponden a la resta exacta del plazo menos las cuotas pagadas
  if (totalMonths && totalMonths > 0 && paidInstallmentsCount > 0) {
    return Math.max(0, totalMonths - paidInstallmentsCount);
  }

  // 2. Si no se especificaron cuotas pagadas o no hay totalMonths, calcular amortización financiera:
  const im = calculateMonthlyRate(annualInterestRate, isNominal);
  if (monthlyPayment <= 0) {
    return totalMonths ? Math.max(0, totalMonths - paidInstallmentsCount) : 0;
  }

  let nRestantes: number;
  if (im <= 0) {
    nRestantes = cleanMonths(balance / monthlyPayment);
  } else {
    const ratio = (balance * im) / monthlyPayment;
    if (ratio >= 1) {
      nRestantes = totalMonths ?? 600;
    } else {
      const raw = -Math.log(1 - ratio) / Math.log(1 + im);
      nRestantes = cleanMonths(raw);
    }
  }

  if (totalMonths && totalMonths > 0) {
    nRestantes = Math.min(totalMonths, nRestantes);
  }

  return Math.max(0, nRestantes);
}

/**
 * Algoritmo de Amortización Francesa y cálculo de meses restantes
 */
export function calculateAmortization(
  debt: Pick<Debt, 'currentBalance' | 'monthlyPayment' | 'annualInterestRate'> & {
    totalMonths?: number;
    originalAmount?: number;
    paidInstallmentsCount?: number;
    paidMonths?: number;
  },
  baseDate: Date = new Date(),
): AmortizationResult {
  const paidMonths = debt.paidMonths ?? debt.paidInstallmentsCount ?? 0;

  if (debt.currentBalance <= 100) {
    return {
      paidMonths: debt.totalMonths ? Math.max(debt.totalMonths, paidMonths) : paidMonths,
      remainingMonths: 0,
      projectedEndDate: baseDate,
      projectedDateFormatted: 'Liquidada',
      monthly36Series: Array(37).fill(0),
    };
  }

  const remainingMonths = calculateRemainingMonths(
    debt.currentBalance,
    debt.monthlyPayment,
    debt.annualInterestRate,
    debt.totalMonths,
    paidMonths,
  );

  const projectedEndDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + remainingMonths,
    1,
  );

  const im = calculateMonthlyRate(debt.annualInterestRate);
  const monthly36Series: number[] = [Math.round(debt.currentBalance)];
  let s = debt.currentBalance;

  for (let k = 1; k <= 36; k++) {
    if (s <= 0 || k > remainingMonths) {
      s = 0;
    } else {
      const interest = s * im;
      const amort = debt.monthlyPayment > 0 ? Math.max(0, debt.monthlyPayment - interest) : 0;
      s = Math.max(0, s - amort);
      if (k === remainingMonths || s < 100) {
        s = 0;
      }
    }
    monthly36Series.push(Math.round(s));
  }

  return {
    paidMonths,
    remainingMonths,
    projectedEndDate,
    projectedDateFormatted: remainingMonths === 0 ? 'Liquidada' : formatMonthYear(projectedEndDate),
    monthly36Series,
  };
}

export function generateDebtId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
