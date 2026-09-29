import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ExpensesService } from '../../gastos/data/expenses.service';
import type {
  Debt,
  DebtDraft,
  DebtPersonFilter,
  PrepaymentDraft,
} from './debt.model';
import {
  DEBT_PALETTE,
  calculateAmortization,
  generate36MonthLabels,
  generateDebtId,
} from './debt.model';

const STORAGE_KEY = 'expenses_home_debts_v1';

export const DEFAULT_DEBTS: Debt[] = [
  {
    id: 'debt-1',
    name: 'Hipoteca Apartamento',
    person: 'Compartido',
    originalAmount: 80_000_000,
    currentBalance: 64_500_000,
    monthlyPayment: 700_000,
    annualInterestRate: 8.5,
    startDate: '2026-07-01',
    color: DEBT_PALETTE[0],
  },
  {
    id: 'debt-2',
    name: 'Crédito Vehículo',
    person: 'Benny',
    originalAmount: 22_000_000,
    currentBalance: 14_200_000,
    monthlyPayment: 450_000,
    annualInterestRate: 10.2,
    startDate: '2026-07-01',
    color: DEBT_PALETTE[1],
  },
  {
    id: 'debt-3',
    name: 'Tarjeta de Crédito',
    person: 'Charlie',
    originalAmount: 5_000_000,
    currentBalance: 3_800_000,
    monthlyPayment: 500_000,
    annualInterestRate: 24.0,
    startDate: '2026-07-01',
    color: DEBT_PALETTE[2],
  },
  {
    id: 'debt-4',
    name: 'Préstamo Personal',
    person: 'Charlie',
    originalAmount: 8_000_000,
    currentBalance: 5_200_000,
    monthlyPayment: 350_000,
    annualInterestRate: 15.5,
    startDate: '2026-07-01',
    color: DEBT_PALETTE[3],
  },
];

@Injectable({ providedIn: 'root' })
export class DebtsService {
  private readonly supabase = inject(SupabaseService);
  private readonly expensesService = inject(ExpensesService);

  readonly debts = signal<Debt[]>(DEFAULT_DEBTS);
  readonly allDebts = this.debts.asReadonly();

  readonly selectedPerson = signal<DebtPersonFilter>('Todos');

  constructor() {
    this.loadDebts();
    this.setupRealtime();
  }

  setPerson(person: DebtPersonFilter): void {
    this.selectedPerson.set(person);
  }

  /**
   * Deudas filtradas según la persona seleccionada o 'Compartido' (Criterio 84)
   */
  readonly filteredDebts = computed(() => {
    const person = this.selectedPerson();
    const list = this.debts();

    if (person === 'Todos') {
      return list;
    }
    return list.filter((d) => d.person === person || d.person === 'Compartido');
  });

  /**
   * Indicadores dinámicos superiores (Criterio 1.2)
   */
  readonly summaryKpis = computed(() => {
    const list = this.filteredDebts();

    let totalOriginal = 0;
    let totalDebt = 0;
    let monthlyPayment = 0;

    for (const d of list) {
      totalOriginal += d.originalAmount;
      totalDebt += d.currentBalance;
      monthlyPayment += d.monthlyPayment;
    }

    const paidPercentage =
      totalOriginal > 0
        ? ((totalOriginal - totalDebt) / totalOriginal) * 100
        : 0;

    return {
      totalDebt,
      monthlyPayment,
      paidPercentage: Math.max(0, paidPercentage),
      count: list.length,
    };
  });

  /**
   * Datos para el gráfico de líneas de proyección a 36 meses (Criterio 4.1)
   */
  readonly projectionChartData = computed(() => {
    const list = this.filteredDebts();
    const labels = generate36MonthLabels();

    const datasets = list.map((debt) => {
      const amort = calculateAmortization(debt);
      return {
        label: debt.name,
        data: amort.monthly36Series,
        borderColor: debt.color,
        backgroundColor: debt.color,
        tension: 0.2,
        pointRadius: 2,
        pointHoverRadius: 5,
        fill: false,
      };
    });

    return {
      labels,
      datasets,
    };
  });

  /**
   * Datos para el gráfico de barras horizontales de cuotas mensuales (Criterio 4.2)
   */
  readonly paymentsChartData = computed(() => {
    const list = this.filteredDebts();

    return {
      labels: list.map((d) => d.name),
      datasets: [
        {
          label: 'Cuota mensual',
          data: list.map((d) => d.monthlyPayment),
          backgroundColor: list.map((d) => d.color),
          borderRadius: 4,
          maxBarThickness: 24,
        },
      ],
    };
  });

  async loadDebts(): Promise<void> {
    // 1. Cargar primero de localStorage para disponibilidad inmediata
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          this.debts.set(JSON.parse(saved));
        } catch {
          // JSON malformado
        }
      }
    }

    // 2. Sincronizar desde Supabase si la tabla existe
    try {
      const { data, error } = await this.supabase.client
        .from('debts')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        // La tabla puede no haber sido creada aún en Supabase
        return;
      }

      if (data && data.length > 0) {
        const mapped: Debt[] = data.map((item: any, idx: number) => ({
          id: String(item.id),
          name: String(item.name),
          person: item.person,
          startDate: String(item.start_date || item.startDate),
          originalAmount: Number(item.original_amount || item.originalAmount),
          currentBalance: Number(item.current_balance || item.currentBalance),
          monthlyPayment: Number(item.monthly_payment || item.monthlyPayment),
          annualInterestRate: Number(
            item.annual_interest_rate || item.annualInterestRate,
          ),
          color: item.color || DEBT_PALETTE[idx % DEBT_PALETTE.length],
        }));
        this.debts.set(mapped);
        this.persistLocal(mapped);
      }
    } catch {
      // Manejar desconexión o entorno offline
    }
  }

  async addDebt(draft: DebtDraft): Promise<void> {
    const current = this.debts();
    const color = DEBT_PALETTE[current.length % DEBT_PALETTE.length];
    const newDebt: Debt = {
      ...draft,
      id: generateDebtId(),
      color,
    };

    const updated = [...current, newDebt];
    this.debts.set(updated);
    this.persistLocal(updated);

    try {
      await this.supabase.client.from('debts').insert([
        {
          id: newDebt.id,
          name: newDebt.name,
          person: newDebt.person,
          start_date: newDebt.startDate,
          original_amount: newDebt.originalAmount,
          current_balance: newDebt.currentBalance,
          monthly_payment: newDebt.monthlyPayment,
          annual_interest_rate: newDebt.annualInterestRate,
          color: newDebt.color,
        },
      ]);
    } catch {
      // Persistido localmente
    }
  }

  async updateDebt(id: string, draft: DebtDraft): Promise<void> {
    const current = this.debts();
    const updated = current.map((d) => (d.id === id ? { ...d, ...draft } : d));
    this.debts.set(updated);
    this.persistLocal(updated);

    try {
      await this.supabase.client
        .from('debts')
        .update({
          name: draft.name,
          person: draft.person,
          start_date: draft.startDate,
          original_amount: draft.originalAmount,
          current_balance: draft.currentBalance,
          monthly_payment: draft.monthlyPayment,
          annual_interest_rate: draft.annualInterestRate,
        })
        .eq('id', id);
    } catch {
      // Persistido localmente
    }
  }

  async deleteDebt(id: string): Promise<void> {
    const current = this.debts();
    const updated = current.filter((d) => d.id !== id);
    this.debts.set(updated);
    this.persistLocal(updated);

    try {
      await this.supabase.client.from('debts').delete().eq('id', id);
    } catch {
      // Persistido localmente
    }
  }

  /**
   * Criterio 48 / 82:
   * Aplica un abono adicional a capital, reduce el saldo de la deuda,
   * recalcula proyecciones y registra automáticamente el egreso en Gastos Diarios.
   */
  async applyPrepayment(draft: PrepaymentDraft): Promise<void> {
    const debt = this.debts().find((d) => d.id === draft.debtId);
    if (!debt || draft.amount <= 0) return;

    const newBalance = Math.max(0, debt.currentBalance - draft.amount);
    await this.updateDebt(debt.id, {
      ...debt,
      currentBalance: newBalance,
    });

    // Registrar egreso automático en Gastos Diarios
    await this.expensesService.addExpense({
      date: draft.date,
      person: debt.person,
      category: 'Otros',
      description: `Abono a capital: ${debt.name}`,
      amount: draft.amount,
    });
  }

  private persistLocal(debts: Debt[]): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(debts));
      } catch {
        // Quota exceeded
      }
    }
  }

  private setupRealtime(): void {
    const proc = (globalThis as any).process;
    if (proc?.env?.['NODE_ENV'] === 'test' || proc?.env?.['VITEST']) {
      return;
    }

    try {
      this.supabase.client
        .channel('public:debts')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'debts' },
          () => {
            this.loadDebts();
          },
        )
        .subscribe();
    } catch {
      // Realtime no disponible
    }
  }
}
