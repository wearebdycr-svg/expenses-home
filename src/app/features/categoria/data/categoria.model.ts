import {
  EXPENSE_CATEGORIES,
  EXPENSE_PERSONS,
  MONTHS,
  YEARS,
  getExpenseCategoryColor,
  type ExpenseCategory,
  type ExpensePerson,
  type ExpensePersonFilter,
} from '../../gastos/data/expense.model';
import type { DayFilter, MonthFilter } from '../../gastos/data/expenses.service';

export {
  EXPENSE_CATEGORIES,
  EXPENSE_PERSONS,
  MONTHS,
  YEARS,
  getExpenseCategoryColor as getCategoryColor,
  type DayFilter,
  type ExpenseCategory,
  type ExpensePerson,
  type ExpensePersonFilter,
  type MonthFilter,
};

export type BudgetStatus = 'normal' | 'warning' | 'exceeded' | 'none';

export interface CategoryTableRow {
  category: ExpenseCategory;
  color: string;
  benny: number;
  charlie: number;
  compartido: number;
  total: number;
  percentage: number;
  transactionCount: number;
  budget: number | null;
  budgetPercentage: number | null;
  budgetStatus: BudgetStatus;
  statusColor: string;
}

export interface LegendCategoryItem {
  category: ExpenseCategory;
  color: string;
  percentage: number;
  amount: number;
}

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  'Ahorro/inversión': '#14b8a6',
  Compras: '#ec4899',
  'Cuidado personal': '#d946ef',
  Deudas: '#ef4444',
  Educación: '#eab308',
  'Entretenimiento/salidas': '#a855f7',
  Hogar: '#84cc16',
  'Impuestos/trámites': '#475569',
  Mascotas: '#f59e0b',
  Mercado: '#10b981',
  Otros: '#94a3b8',
  Regalos: '#f97316',
  'Restaurantes/domicilios': '#fb923c',
  'Ropa y calzado': '#8b5cf6',
  Salud: '#06b6d4',
  'Servicios públicos': '#64748b',
  Suscripciones: '#6366f1',
  Tecnología: '#3b82f6',
  Transporte: '#2563eb',
  'Vehículo/gasolina': '#dc2626',
  Viajes: '#0ea5e9',
  'TC-compartida': '#8b5cf6',
};

export const MEMBER_COLORS: Record<ExpensePerson, string> = {
  Benny: '#3b82f6',
  Charlie: '#f59e0b',
  Compartido: '#10b981',
};

export function formatCOP(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rounded < 0 ? `-$ ${formatted}` : `$ ${formatted}`;
}

export function formatAxisCurrencyK(value: number): string {
  if (value === 0) return '$0k';
  const thousands = Math.round(value / 1000);
  return `$${thousands}k`;
}
