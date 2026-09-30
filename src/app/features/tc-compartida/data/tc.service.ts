import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import type { Expense, ExpensePerson, ExpensePersonFilter } from '../../gastos/data/expense.model';
import { EXPENSE_PERSON_COLORS, EXPENSE_PERSONS } from '../../gastos/data/expense.model';
import { ExpensesService } from '../../gastos/data/expenses.service';
import type { TcExpense, TcExpenseDraft, TcPersonMetrics } from './tc.model';
import { generateTcExpenseId } from './tc.model';

const STORAGE_KEY = 'expenses_home_tc_v1';

@Injectable({ providedIn: 'root' })
export class TcService {
  private readonly supabase = inject(SupabaseService);
  private readonly expensesService = inject(ExpensesService);

  private readonly tcExpenses = signal<TcExpense[]>([]);
  readonly allTcExpenses = this.tcExpenses.asReadonly();
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Filters
  readonly personFilter = signal<ExpensePersonFilter>('Todos');
  readonly searchQuery = signal<string>('');

  constructor() {
    this.loadFromStorage();
    this.loadTcExpenses();
    this.setupRealtime();
  }

  /**
   * Abonos y amortizaciones hacia la tarjeta:
   * Gastos registrados en la vista general de Gastos bajo la categoría "TC-compartida".
   * Se actualizan automáticamente en tiempo real gracias a la reactividad de ExpensesService.
   */
  readonly payments = computed<Expense[]>(() => {
    return this.expensesService
      .allExpenses()
      .filter((exp) => exp.category === 'TC-compartida')
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  /** Consumos filtrados por persona y búsqueda */
  readonly filteredTcExpenses = computed<TcExpense[]>(() => {
    const person = this.personFilter();
    const query = this.searchQuery().trim().toLowerCase();

    return this.tcExpenses()
      .filter((exp) => {
        const matchesPerson = person === 'Todos' || exp.person === person;
        const matchesQuery =
          !query ||
          exp.description.toLowerCase().includes(query) ||
          (exp.category && exp.category.toLowerCase().includes(query));
        return matchesPerson && matchesQuery;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  /** Abonos filtrados por persona */
  readonly filteredPayments = computed<Expense[]>(() => {
    const person = this.personFilter();
    return this.payments().filter((p) => person === 'Todos' || p.person === person);
  });

  /** Total acumulado de consumos directos de la TC */
  readonly totalConsumptions = computed<number>(() => {
    return this.tcExpenses().reduce((sum, item) => sum + item.amount, 0);
  });

  /** Total de abonos / pagos amortizados desde Gastos Diarios ('TC-compartida') */
  readonly totalPayments = computed<number>(() => {
    return this.payments().reduce((sum, item) => sum + item.amount, 0);
  });

  /**
   * Deuda Pendiente TC (Saldo real amortizado):
   * Deuda Pendiente TC = ∑(Consumos en Gastos TC Compartida) - ∑(Gastos con categoría "TC-compartida" en Vista Gastos)
   */
  readonly pendingDebt = computed<number>(() => {
    return this.totalConsumptions() - this.totalPayments();
  });

  /** Desglose por responsable/persona */
  readonly personMetrics = computed<TcPersonMetrics[]>(() => {
    const totalCons = this.totalConsumptions();
    const allExpensesList = this.tcExpenses();
    const allPaymentsList = this.payments();

    return EXPENSE_PERSONS.map((person: ExpensePerson) => {
      const consumptions = allExpensesList
        .filter((e) => e.person === person)
        .reduce((sum, e) => sum + e.amount, 0);

      const payments = allPaymentsList
        .filter((p) => p.person === person)
        .reduce((sum, p) => sum + p.amount, 0);

      const percentageOfConsumptions =
        totalCons > 0 ? (consumptions / totalCons) * 100 : 0;

      return {
        person,
        consumptions,
        payments,
        netBalance: consumptions - payments,
        percentageOfConsumptions,
        color: EXPENSE_PERSON_COLORS[person] ?? '#94a3b8',
      };
    });
  });

  setPersonFilter(person: ExpensePersonFilter): void {
    this.personFilter.set(person);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  async loadTcExpenses(): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('tc_expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.warn(
          'Supabase: No se pudieron cargar los consumos de TC (verifica si la tabla tc_expenses existe):',
          error.message,
        );
        this.error.set(error.message);
        // Si hay error en Supabase, conservamos lo que esté en localStorage
        return;
      }

      if (data) {
        const mapped: TcExpense[] = data.map((item: any) => ({
          id: String(item.id),
          date: String(item.date),
          person: item.person as ExpensePerson,
          description: String(item.description),
          amount: Number(item.amount),
          category: item.category ? String(item.category) : 'General',
          createdAt: item.created_at ? String(item.created_at) : undefined,
        }));
        this.tcExpenses.set(mapped);
        this.saveToStorage(mapped);
        this.error.set(null);
      }
    } catch (err: any) {
      console.warn('Error al cargar consumos de TC de Supabase:', err);
      this.error.set(err?.message ?? 'Error inesperado de conexión');
    } finally {
      this.loading.set(false);
    }
  }

  async addTcExpense(draft: TcExpenseDraft): Promise<void> {
    const tempId = generateTcExpenseId();
    const optimisticItem: TcExpense = { ...draft, id: tempId };

    // Actualización optimista
    this.tcExpenses.update((list) => {
      const updated = [optimisticItem, ...list];
      this.saveToStorage(updated);
      return updated;
    });

    try {
      const { data, error } = await this.supabase.client
        .from('tc_expenses')
        .insert([
          {
            date: draft.date,
            person: draft.person,
            description: draft.description,
            amount: draft.amount,
            category: draft.category || 'General',
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error insertando consumo TC en Supabase:', error);
        this.error.set(error.message);
        return;
      }

      if (data) {
        this.tcExpenses.update((list) => {
          const updated = list.map((item) =>
            item.id === tempId ? { ...item, id: String(data.id) } : item,
          );
          this.saveToStorage(updated);
          return updated;
        });
      }
    } catch (err: any) {
      console.error('Error de red al insertar consumo TC:', err);
    }
  }

  async updateTcExpense(id: string, draft: TcExpenseDraft): Promise<void> {
    // Actualización optimista
    this.tcExpenses.update((list) => {
      const updated = list.map((item) => (item.id === id ? { ...draft, id } : item));
      this.saveToStorage(updated);
      return updated;
    });

    try {
      const { error } = await this.supabase.client
        .from('tc_expenses')
        .update({
          date: draft.date,
          person: draft.person,
          description: draft.description,
          amount: draft.amount,
          category: draft.category || 'General',
        })
        .eq('id', id);

      if (error) {
        console.error('Error actualizando consumo TC en Supabase:', error);
        this.error.set(error.message);
      }
    } catch (err: any) {
      console.error('Error de red al actualizar consumo TC:', err);
    }
  }

  async deleteTcExpense(id: string): Promise<void> {
    // Actualización optimista
    this.tcExpenses.update((list) => {
      const updated = list.filter((item) => item.id !== id);
      this.saveToStorage(updated);
      return updated;
    });

    try {
      const { error } = await this.supabase.client
        .from('tc_expenses')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error eliminando consumo TC en Supabase:', error);
        this.error.set(error.message);
      }
    } catch (err: any) {
      console.error('Error de red al eliminar consumo TC:', err);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.tcExpenses.set(parsed);
        }
      }
    } catch (e) {
      console.warn('No se pudo leer localStorage para TC:', e);
    }
  }

  private saveToStorage(list: TcExpense[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('No se pudo guardar en localStorage para TC:', e);
    }
  }

  private setupRealtime(): void {
    const proc = (globalThis as any).process;
    if (proc?.env?.['NODE_ENV'] === 'test' || proc?.env?.['VITEST']) {
      return;
    }

    try {
      this.supabase.client
        .channel('public:tc_expenses')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tc_expenses' },
          () => {
            this.loadTcExpenses();
          },
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription no disponible para tc_expenses:', err);
    }
  }
}
