export type PersonFilter = 'Todos' | 'Ana' | 'Carlos';
export type Person = 'Ana' | 'Carlos';

export type IncomeSource = 'Salario' | 'Freelance' | 'Arriendo' | 'Inversiones' | 'Bono' | 'Otros';

export interface Income {
  id: string;
  /** ISO date, yyyy-MM-dd */
  date: string;
  person: Person;
  source: IncomeSource;
  description: string;
  amount: number;
}

export type IncomeDraft = Omit<Income, 'id'>;

export const YEARS: readonly number[] = [2025, 2026];

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

export const PERSONS: readonly Person[] = ['Ana', 'Carlos'];

export const INCOME_SOURCES: readonly IncomeSource[] = [
  'Salario',
  'Freelance',
  'Arriendo',
  'Inversiones',
  'Bono',
  'Otros',
];

export const PERSON_COLORS: Record<Person, string> = {
  Ana: '#3B82F6',
  Carlos: '#F59E0B',
};

export const TOTAL_COLOR = '#10B981';

export const SOURCE_COLORS: Record<IncomeSource, string> = {
  Salario: '#3B82F6',
  Freelance: '#A855F7',
  Arriendo: '#10B981',
  Inversiones: '#F59E0B',
  Bono: '#EC4899',
  Otros: '#64748B',
};

export function generateId(): string {
  return `inc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
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
