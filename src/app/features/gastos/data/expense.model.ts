export type ExpensePerson = 'Benny' | 'Charlie' | 'Compartido';
export type ExpensePersonFilter = 'Todos' | 'Benny' | 'Charlie' | 'Compartido';

export type ExpenseCategory =
  | 'Alimentación'
  | 'Transporte'
  | 'Salud'
  | 'Entretenimiento'
  | 'Educación'
  | 'Ropa'
  | 'Tecnología'
  | 'Restaurantes'
  | 'Cuidado Personal'
  | 'Hogar'
  | 'Servicios'
  | 'Ahorro / Inversión'
  | 'Otros';

export interface Expense {
  id: string;
  /** ISO date, yyyy-MM-dd */
  date: string;
  person: ExpensePerson;
  category: ExpenseCategory;
  description: string;
  amount: number;
}

export type ExpenseDraft = Omit<Expense, 'id'>;

const currentYear = new Date().getFullYear();
const startYear = Math.min(2025, currentYear - 1);
const endYear = Math.max(2026, currentYear + 1);
export const YEARS: readonly number[] = Array.from(
  { length: endYear - startYear + 1 },
  (_, i) => startYear + i
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

export const EXPENSE_PERSONS: readonly ExpensePerson[] = ['Benny', 'Charlie', 'Compartido'];

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  'Alimentación',
  'Transporte',
  'Salud',
  'Entretenimiento',
  'Educación',
  'Ropa',
  'Tecnología',
  'Restaurantes',
  'Cuidado Personal',
  'Hogar',
  'Servicios',
  'Ahorro / Inversión',
  'Otros',
];

export const EXPENSE_PERSON_COLORS: Record<ExpensePerson, string> = {
  Benny: '#3B82F6',
  Charlie: '#F59E0B',
  Compartido: '#10B981',
};

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Hogar: '#84cc16',
  Alimentación: '#10b981',
  Transporte: '#3b82f6',
  Servicios: '#64748b',
  Restaurantes: '#ef4444',
  Salud: '#06b6d4',
  Entretenimiento: '#a855f7',
  Educación: '#eab308',
  Ropa: '#ec4899',
  Tecnología: '#6366f1',
  'Cuidado Personal': '#f97316',
  'Ahorro / Inversión': '#14b8a6',
  Otros: '#94a3b8',
};

export function generateExpenseId(): string {
  return `exp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const formatted = DISPLAY_DATE_FORMATTER.format(date).replace('.', '');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
