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
  calculateMonthlyRate,
  differenceInMonths,
  generate36MonthLabels,
  generateDebtId,
} from './debt.model';

const STORAGE_KEY = 'expenses_home_debts_v2';

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
  private lastLocalMutationTime = 0;

  readonly debts = signal<Debt[]>([]);

  /**
   * Deudas con saldo pendiente y estado calculados en tiempo real:
   * Saldo Pendiente = Monto Total Inicial - ∑(Monto de Gastos donde categoría = nombre_deuda)
   * Si Saldo Pendiente <= 0, estado = 'saldada'.
   */
  readonly debtsWithLiveBalance = computed<Debt[]>(() => {
    const rawDebts = this.debts();
    const allExpenses = this.expensesService.allExpenses();

    return rawDebts.map((d) => {
      // 1. Filtrar y ordenar cronológicamente los gastos registrados para esta deuda
      const matchingExpenses = allExpenses
        .filter((e) => {
          if (!e.category) return false;
          const cat = e.category.trim().toLowerCase();
          const debtName = d.name.trim().toLowerCase();
          return (
            cat === debtName ||
            cat === `deuda: ${debtName}` ||
            cat === `deuda: ${debtName} (inactiva)` ||
            (cat === 'deudas' && e.description.toLowerCase().includes(debtName))
          );
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      const im = calculateMonthlyRate(d.annualInterestRate);
      let balance = d.currentBalance ?? d.originalAmount;
      let totalAmortized = 0;
      let paidInstallmentsCount = 0;

      for (const e of matchingExpenses) {
        const desc = (e.description || '').toLowerCase();
        const isPrepayment =
          desc.includes('capital') ||
          (desc.includes('abono') && !desc.includes('cuota'));

        if (isPrepayment || im <= 0) {
          // Abono directo a capital o crédito sin intereses
          const amort = Math.min(balance, e.amount);
          balance = Math.max(0, balance - amort);
          totalAmortized += amort;
        } else {
          // Cuota periódica regular con amortización francesa
          const interest = balance * im;
          const amort = Math.min(balance, Math.max(0, e.amount - interest));
          balance = Math.max(0, balance - amort);
          totalAmortized += amort;
        }

        if (!isPrepayment) {
          paidInstallmentsCount += 1;
        }
      }
      const isSettled = balance <= 100 || d.status === 'saldada';
      const status = isSettled ? ('saldada' as const) : ('activa' as const);

      // Cálculo de la cantidad de meses o cuotas pagadas desde la fecha de inicio o primer pago
      const now = new Date();
      const elapsedMonthsFromStart = differenceInMonths(d.startDate, now);

      let paidMonths = Math.max(elapsedMonthsFromStart, paidInstallmentsCount);
      if (elapsedMonthsFromStart > 0 && paidInstallmentsCount > 0) {
        const expensesInCurrentOrFuture = matchingExpenses.filter((e) => {
          const [y, m] = e.date.split('-').map(Number);
          return (
            y > now.getFullYear() ||
            (y === now.getFullYear() && m >= now.getMonth() + 1)
          );
        }).length;
        paidMonths = elapsedMonthsFromStart + expensesInCurrentOrFuture;
      }

      if (isSettled && d.totalMonths) {
        paidMonths = d.totalMonths;
      } else if (d.totalMonths) {
        paidMonths = Math.min(d.totalMonths, paidMonths);
      }

      return {
        ...d,
        currentBalance: Math.round(balance),
        status,
        totalAmortized: Math.round(totalAmortized),
        paidMonths,
        paidInstallmentsCount: paidMonths,
      };
    });
  });

  readonly allDebts = this.debtsWithLiveBalance;

  /**
   * Deudas activas disponibles para amortizar en el selector de Gastos
   */
  readonly activeDebts = computed<Debt[]>(() => {
    return this.debtsWithLiveBalance().filter((d) => d.status === 'activa' && d.currentBalance > 0);
  });

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
    const list = this.debtsWithLiveBalance();

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
        console.warn('Supabase: No se pudieron cargar las deudas:', error.message);
        return;
      }

      if (data) {
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
          totalMonths: item.total_months
            ? Number(item.total_months)
            : item.totalMonths
              ? Number(item.totalMonths)
              : undefined,
          color: item.color || DEBT_PALETTE[idx % DEBT_PALETTE.length],
          status: item.status || 'activa',
        }));

        // Preservar deudas locales que aún no se hayan sincronizado con Supabase para evitar borrarlas al refrescar
        const serverIds = new Set(mapped.map((d) => d.id));
        const localPending = this.debts().filter((d) => !serverIds.has(d.id));

        const finalDebts = [...mapped, ...localPending];
        this.debts.set(finalDebts);
        this.persistLocal(finalDebts);

        // Auto-sincronizar deudas pendientes locales en Supabase
        if (localPending.length > 0) {
          this.syncPendingDebtsToSupabase(localPending);
        }
      }
    } catch (err: any) {
      console.warn('Error conectando a Supabase para deudas:', err);
    }
  }

  private async syncPendingDebtsToSupabase(pending: Debt[]): Promise<void> {
    for (const d of pending) {
      try {
        const payload: Record<string, any> = {
          name: d.name,
          person: d.person,
          start_date: d.startDate,
          original_amount: d.originalAmount,
          current_balance: d.currentBalance,
          monthly_payment: d.monthlyPayment,
          annual_interest_rate: d.annualInterestRate,
          color: d.color,
          status: d.status || 'activa',
        };
        if (d.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.id)) {
          payload['id'] = d.id;
        }
        if (d.totalMonths != null) {
          payload['total_months'] = d.totalMonths;
        }

        let { data, error } = await this.supabase.client
          .from('debts')
          .insert([payload])
          .select()
          .single();

        if (error && error.message.includes('total_months')) {
          delete payload['total_months'];
          const retry = await this.supabase.client
            .from('debts')
            .insert([payload])
            .select()
            .single();
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          console.warn(`Supabase: No se pudo auto-sincronizar la deuda "${d.name}":`, error.message);
        } else if (data && data.id) {
          if (String(data.id) !== d.id) {
            d.id = String(data.id);
            this.persistLocal(this.debts());
          }
        }
      } catch (err: any) {
        console.warn(`Supabase: Error de red sincronizando deuda "${d.name}":`, err);
      }
    }
  }

  async addDebt(draft: DebtDraft): Promise<void> {
    this.lastLocalMutationTime = Date.now();
    const current = this.debts();
    const color = DEBT_PALETTE[current.length % DEBT_PALETTE.length];
    const newDebt: Debt = {
      ...draft,
      id: generateDebtId(),
      color,
      status: draft.status || 'activa',
    };

    const updated = [...current, newDebt];
    this.debts.set(updated);
    this.persistLocal(updated);

    try {
      const payload: Record<string, any> = {
        name: newDebt.name,
        person: newDebt.person,
        start_date: newDebt.startDate,
        original_amount: newDebt.originalAmount,
        current_balance: newDebt.currentBalance,
        monthly_payment: newDebt.monthlyPayment,
        annual_interest_rate: newDebt.annualInterestRate,
        color: newDebt.color,
        status: newDebt.status,
      };
      if (newDebt.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newDebt.id)) {
        payload['id'] = newDebt.id;
      }
      if (newDebt.totalMonths != null) {
        payload['total_months'] = newDebt.totalMonths;
      }

      let { data, error } = await this.supabase.client
        .from('debts')
        .insert([payload])
        .select()
        .single();

      if (error && error.message.includes('total_months')) {
        delete payload['total_months'];
        const retry = await this.supabase.client
          .from('debts')
          .insert([payload])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Error insertando deuda en Supabase:', error.message);
      } else if (data && data.id) {
        newDebt.id = String(data.id);
        this.persistLocal(this.debts());
      }
    } catch (err: any) {
      console.error('Error de red insertando deuda en Supabase:', err);
    }
  }

  async updateDebt(id: string, draft: DebtDraft): Promise<void> {
    this.lastLocalMutationTime = Date.now();
    const current = this.debts();
    const oldDebt = current.find((d) => d.id === id);
    const oldName = oldDebt?.name;
    const newName = draft.name;

    const updated = current.map((d) => (d.id === id ? { ...d, ...draft } : d));
    this.debts.set(updated);
    this.persistLocal(updated);

    try {
      const payload: Record<string, any> = {
        name: draft.name,
        person: draft.person,
        start_date: draft.startDate,
        original_amount: draft.originalAmount,
        current_balance: draft.currentBalance,
        monthly_payment: draft.monthlyPayment,
        annual_interest_rate: draft.annualInterestRate,
        status: draft.status || 'activa',
      };
      if (draft.totalMonths != null) {
        payload['total_months'] = draft.totalMonths;
      }

      let { error } = await this.supabase.client
        .from('debts')
        .update(payload)
        .eq('id', id);

      if (error && error.message.includes('total_months')) {
        delete payload['total_months'];
        const retry = await this.supabase.client
          .from('debts')
          .update(payload)
          .eq('id', id);
        error = retry.error;
      }

      if (error) {
        console.error('Error actualizando deuda en Supabase:', error.message);
      }

      // Cascada: Si el nombre cambió, actualizar todos los gastos asociados
      if (oldName && oldName !== newName) {
        await this.expensesService.renameCategory(oldName, newName);
      }
    } catch (err: any) {
      console.error('Error de red actualizando deuda en Supabase:', err);
      if (oldName && oldName !== newName) {
        await this.expensesService.renameCategory(oldName, newName);
      }
    }
  }

  async deleteDebt(id: string): Promise<void> {
    this.lastLocalMutationTime = Date.now();
    const current = this.debts();
    const updated = current.filter((d) => d.id !== id);
    this.debts.set(updated);
    this.persistLocal(updated);

    try {
      const { error } = await this.supabase.client.from('debts').delete().eq('id', id);
      if (error) {
        console.error('Error eliminando deuda en Supabase:', error.message);
      }
    } catch (err: any) {
      console.error('Error de red eliminando deuda en Supabase:', err);
    }
  }

  /**
   * Criterio 48 / 82:
   * Aplica un abono adicional a capital, registra automáticamente el egreso en Gastos Diarios
   * vinculando la categoría exacta de la deuda para descontar el saldo pendiente en tiempo real.
   */
  async applyPrepayment(draft: PrepaymentDraft): Promise<void> {
    const debt = this.debtsWithLiveBalance().find((d) => d.id === draft.debtId);
    if (!debt || draft.amount <= 0) return;

    // Registrar egreso automático en Gastos Diarios con la categoría exacta de la deuda
    await this.expensesService.addExpense({
      date: draft.date,
      person: debt.person,
      category: debt.name,
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
            if (Date.now() - this.lastLocalMutationTime < 2500) {
              return;
            }
            this.loadDebts();
          },
        )
        .subscribe();
    } catch {
      // Realtime no disponible
    }
  }
}
