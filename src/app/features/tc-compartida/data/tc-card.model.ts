import type { ExpensePerson } from '../../gastos/data/expense.model';

export interface CardTheme {
  id: string;
  name: string;
  primaryColor: string;
  gradient: string;
  textColor: string;
}

export const TC_CARD_THEMES: readonly CardTheme[] = [
  {
    id: 'emerald',
    name: 'Verde Esmeralda',
    primaryColor: '#10B981',
    gradient: 'linear-gradient(135deg, #065F46 0%, #10B981 50%, #047857 100%)',
    textColor: '#FFFFFF',
  },
  {
    id: 'nu-purple',
    name: 'Púrpura Nu',
    primaryColor: '#820AD1',
    gradient: 'linear-gradient(135deg, #530082 0%, #820AD1 50%, #3C0060 100%)',
    textColor: '#FFFFFF',
  },
  {
    id: 'navy-blue',
    name: 'Azul Marino',
    primaryColor: '#2563EB',
    gradient: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #172554 100%)',
    textColor: '#FFFFFF',
  },
  {
    id: 'carbon-black',
    name: 'Negro Carbón',
    primaryColor: '#1F2937',
    gradient: 'linear-gradient(135deg, #111827 0%, #374151 50%, #030712 100%)',
    textColor: '#FFFFFF',
  },
  {
    id: 'amber-gold',
    name: 'Dorado Ámbar',
    primaryColor: '#F59E0B',
    gradient: 'linear-gradient(135deg, #B45309 0%, #F59E0B 50%, #78350F 100%)',
    textColor: '#FFFFFF',
  },
  {
    id: 'ruby-red',
    name: 'Rojo Rubí',
    primaryColor: '#EF4444',
    gradient: 'linear-gradient(135deg, #991B1B 0%, #EF4444 50%, #7F1D1D 100%)',
    textColor: '#FFFFFF',
  },
  {
    id: 'ocean-cyan',
    name: 'Azul Océano',
    primaryColor: '#06B6D4',
    gradient: 'linear-gradient(135deg, #164E63 0%, #0891B2 50%, #0E7490 100%)',
    textColor: '#FFFFFF',
  },
];

export interface TcCard {
  id: string;
  name: string;
  bank: string;
  lastDigits: string;
  person: ExpensePerson;
  themeId: string;
  color: string;
  gradient: string;
  quota?: number;
  paymentCategory?: string;
  isDefault?: boolean;
  description?: string;
  createdAt?: string;
}

export type TcCardDraft = Omit<TcCard, 'id' | 'gradient' | 'color' | 'isDefault' | 'createdAt'>;

export const DEFAULT_TC_CARDS: readonly TcCard[] = [
  {
    id: 'tc-compartida',
    name: 'TC Compartida',
    bank: 'Bancolombia',
    lastDigits: '0066',
    person: 'Compartido',
    themeId: 'emerald',
    color: '#10B981',
    gradient: 'linear-gradient(135deg, #065F46 0%, #10B981 50%, #047857 100%)',
    quota: 5000000,
    paymentCategory: 'TC-compartida',
    isDefault: true,
    description: 'Tarjeta compartida principal de compras del hogar y mercado',
  },
  {
    id: 'tc-nu-charlie',
    name: 'TC Nu Charlie',
    bank: 'Nu Colombia',
    lastDigits: '4312',
    person: 'Charlie',
    themeId: 'nu-purple',
    color: '#820AD1',
    gradient: 'linear-gradient(135deg, #530082 0%, #820AD1 50%, #3C0060 100%)',
    quota: 3000000,
    paymentCategory: 'Deudas',
    isDefault: false,
    description: 'Tarjeta de crédito personal Nu',
  },
];

export function generateCardId(name: string): string {
  const clean = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-');
  return `tc-${clean}-${Date.now().toString(36)}`;
}

export interface TcCardMetrics {
  consumptionsThisMonth: number;
  totalConsumptions: number;
  totalPayments: number;
  pendingDebt: number;
  countThisMonth: number;
  totalCount: number;
  quota?: number;
  quotaRemaining?: number;
}

export interface TcCardsSummary {
  totalCards: number;
  totalConsumptionsMonth: number;
  totalPendingDebt: number;
  totalPaymentsMonth: number;
  totalExpensesCount: number;
}

