import type { ExpensePerson, ExpensePersonFilter } from '../../gastos/data/expense.model';
import {
  EXPENSE_PERSON_COLORS,
  EXPENSE_PERSONS,
  MONTHS,
  YEARS,
  formatCOP,
  formatDisplayDate,
} from '../../gastos/data/expense.model';

export type MonthFilter = number | 'Todos';
export type DayFilter = number | 'Todos';

export {
  EXPENSE_PERSON_COLORS,
  EXPENSE_PERSONS,
  MONTHS,
  YEARS,
  formatCOP,
  formatDisplayDate,
  type ExpensePerson,
  type ExpensePersonFilter,
};

export * from './tc-card.model';

export interface TcExpense {
  id: string;
  /** ISO date, yyyy-MM-dd */
  date: string;
  person: ExpensePerson;
  description: string;
  amount: number;
  category?: string;
  cardId?: string;
  createdAt?: string;
}

export type TcExpenseDraft = Omit<TcExpense, 'id' | 'createdAt'>;

export interface TcPersonMetrics {
  person: ExpensePerson;
  consumptions: number;
  payments: number;
  netBalance: number;
  percentageOfConsumptions: number;
  color: string;
}

export interface TcKpiSummary {
  totalConsumptions: number;
  totalPayments: number;
  pendingDebt: number;
  consumptionCount: number;
  paymentCount: number;
}

export const TC_DEFAULT_CATEGORIES: readonly string[] = [
  'General',
  'Mercado',
  'Compras',
  'Entretenimiento/salidas',
  'Viajes',
  'Transporte',
  'Hogar',
  'Salud',
  'Educación',
  'Servicios públicos',
  'Suscripciones',
  'Regalos',
  'Otros',
];

export function generateTcExpenseId(): string {
  return `tc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
