import type { ExpensePerson } from '../../gastos/data/expense.model';

export type FixedExpenseStatus = 'activo' | 'inactivo';

export interface FixedExpense {
  id: string;
  name: string;
  expectedAmount: number;
  person: ExpensePerson;
  dueDay?: number; // Día límite del mes (1-31)
  status: FixedExpenseStatus;
  notes?: string;
  createdAt: string;
}

export type FixedExpenseDraft = Omit<FixedExpense, 'id' | 'createdAt'>;

export interface FixedExpenseMonthlyStatus {
  fixedExpense: FixedExpense;
  isPaid: boolean;
  paidAmount: number;
  paidDate?: string;
  expenseId?: string;
  expenseDescription?: string;
}

export interface FixedExpensesSummary {
  totalFixed: number;
  totalExpectedAmount: number;
  totalPaidAmount: number;
  totalPendingAmount: number;
  paidCount: number;
  pendingCount: number;
  progressPercentage: number;
}
