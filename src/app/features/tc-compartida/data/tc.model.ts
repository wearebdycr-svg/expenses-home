import type { Expense, ExpensePerson, ExpensePersonFilter } from '../../gastos/data/expense.model';
import { EXPENSE_PERSON_COLORS, EXPENSE_PERSONS, formatCOP, formatDisplayDate } from '../../gastos/data/expense.model';

export {
  EXPENSE_PERSON_COLORS,
  EXPENSE_PERSONS,
  formatCOP,
  formatDisplayDate,
  type ExpensePerson,
  type ExpensePersonFilter,
};

export interface TcExpense {
  id: string;
  /** ISO date, yyyy-MM-dd */
  date: string;
  person: ExpensePerson;
  description: string;
  amount: number;
  category?: string;
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
  'Supermercado',
  'Restaurantes',
  'Tecnología',
  'Viajes / Transporte',
  'Hogar',
  'Entretenimiento',
  'Salud',
  'Otros',
];

export function generateTcExpenseId(): string {
  return `tc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
