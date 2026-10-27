import type { ExpensePerson } from '../../gastos/data/expense.model';

export type ProjectStatus = 'activo' | 'completado' | 'archivado';

export interface ProjectTheme {
  id: string;
  name: string;
  color: string;
}

export const PROJECT_THEMES: readonly ProjectTheme[] = [
  { id: 'blue', name: 'Azul Océano', color: '#3B82F6' },
  { id: 'emerald', name: 'Verde Esmeralda', color: '#10B981' },
  { id: 'purple', name: 'Púrpura Vibrante', color: '#8B5CF6' },
  { id: 'amber', name: 'Dorado Ámbar', color: '#F59E0B' },
  { id: 'rose', name: 'Rojo Rubí', color: '#F43F5E' },
  { id: 'cyan', name: 'Cian Turquesa', color: '#06B6D4' },
  { id: 'indigo', name: 'Índigo Profundo', color: '#6366F1' },
];

export const PROJECT_ICONS: readonly string[] = [
  '✈️', // Viaje / Paseo
  '🥩', // Asado / Comida
  '🎉', // Fiesta / Evento
  '🎁', // Regalos / Cumpleaños
  '🏖️', // Playa / Vacaciones
  '🛠️', // Remodelación / Hogar
  '🚗', // Vehículo / Paseo en carretera
  '🎓', // Estudio / Grado
  '💻', // Tecnología / Proyecto
  '🏠', // Casa / Finca
  '👶', // Bebé / Familia
  '🎯', // Meta general
];

export interface Project {
  id: string;
  name: string;
  budgetAmount: number;
  person: ExpensePerson;
  icon: string;
  color: string;
  startDate?: string;
  endDate?: string;
  status: ProjectStatus;
  description?: string;
  createdAt: string;
}

export type ProjectDraft = Omit<Project, 'id' | 'createdAt'>;

export interface ProjectExpense {
  id: string;
  projectId: string;
  date: string;
  description: string;
  amount: number;
  person: ExpensePerson;
  category?: string;
  createdAt?: string;
}

export type ProjectExpenseDraft = Omit<ProjectExpense, 'id' | 'createdAt'>;

export interface ProjectMetrics {
  totalExpenses: number;
  remainingBudget: number;
  isOverBudget: boolean;
  overBudgetAmount: number;
  progressPercentage: number;
  expenseCount: number;
  byPerson: {
    Charlie: number;
    Benny: number;
    Compartido: number;
  };
}

export interface ProjectsSummary {
  totalProjects: number;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  isOverBudget: boolean;
}

export function generateProjectId(name: string): string {
  const clean = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-');
  return `proj-${clean}-${Date.now().toString(36)}`;
}

export function generateProjectExpenseId(): string {
  return `pe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
