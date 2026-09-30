import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import type { Expense, ExpensePerson, ExpensePersonFilter } from '../../gastos/data/expense.model';
import { EXPENSE_PERSON_COLORS, EXPENSE_PERSONS } from '../../gastos/data/expense.model';
import { ExpensesService } from '../../gastos/data/expenses.service';
import type { TcExpense, TcExpenseDraft, TcPersonMetrics } from './tc.model';
import { generateTcExpenseId } from './tc.model';

const STORAGE_KEY = 'expenses_home_tc_v1';

export type MonthFilter = number | 'Todos';
export type DayFilter = number | 'Todos';

@Injectable({ providedIn: 'root' })
export class TcService {
  private readonly supabase = inject(SupabaseService);
  private readonly expensesService = inject(ExpensesService);
  private readonly toastService = inject(ToastService);
  private readonly pushNotificationService = inject(PushNotificationService);

  private readonly tcExpenses = signal<TcExpense[]>([]);
  readonly allTcExpenses = this.tcExpenses.asReadonly();
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  private lastLocalMutationTime = 0;

  // Filtros de fecha y responsable
  readonly year = signal<number>(new Date().getFullYear());
  readonly month = signal<MonthFilter>(new Date().getMonth() + 1);
  readonly day = signal<DayFilter>('Todos');
  readonly person = signal<ExpensePersonFilter>('Todos');
  readonly searchQuery = signal<string>('');

  // Alias para retrocompatibilidad
  readonly personFilter = this.person.asReadonly();

  constructor() {
    this.loadFromStorage();
    this.loadTcExpenses();
    this.setupRealtime();
  }

  /**
   * Todos los abonos amortizados hacia la tarjeta:
   * Gastos registrados en la vista general de Gastos bajo la categoría "TC-compartida".
   */
  readonly payments = computed<Expense[]>(() => {
    return this.expensesService
      .allExpenses()
      .filter((exp) => exp.category === 'TC-compartida')
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  /**
   * Consumos de TC filtrados por Año, Mes y Persona
   */
  readonly monthlyTcExpenses = computed<TcExpense[]>(() => {
    const year = this.year();
    const month = this.month();
    const person = this.person();

    return this.tcExpenses().filter((exp) => {
      const [y, m] = exp.date.split('-').map(Number);
      const matchesYear = y === year;
      const matchesMonth = month === 'Todos' || m === month;
      const matchesPerson = person === 'Todos' || exp.person === person;
      return matchesYear && matchesMonth && matchesPerson;
    });
  });

  /**
   * Abonos filtrados por Año, Mes y Persona
   */
  readonly monthlyPayments = computed<Expense[]>(() => {
    const year = this.year();
    const month = this.month();
    const person = this.person();

    return this.payments().filter((p) => {
      const [y, m] = p.date.split('-').map(Number);
      const matchesYear = y === year;
      const matchesMonth = month === 'Todos' || m === month;
      const matchesPerson = person === 'Todos' || p.person === person;
      return matchesYear && matchesMonth && matchesPerson;
    });
  });

  /** Consumos filtrados por Año, Mes, Día, Persona y búsqueda de texto */
  readonly filteredTcExpenses = computed<TcExpense[]>(() => {
    const day = this.day();
    const query = this.searchQuery().trim().toLowerCase();

    return this.monthlyTcExpenses()
      .filter((exp) => {
        const [, , d] = exp.date.split('-').map(Number);
        const matchesDay = day === 'Todos' || d === day;
        const matchesQuery =
          !query ||
          exp.description.toLowerCase().includes(query) ||
          (exp.category && exp.category.toLowerCase().includes(query));
        return matchesDay && matchesQuery;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  /** Abonos filtrados por Año, Mes, Día y Persona */
  readonly filteredPayments = computed<Expense[]>(() => {
    const day = this.day();

    return this.monthlyPayments()
      .filter((p) => {
        const [, , d] = p.date.split('-').map(Number);
        return day === 'Todos' || d === day;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  /** Total consumos del período seleccionado */
  readonly totalConsumptions = computed<number>(() => {
    return this.filteredTcExpenses().reduce((sum, item) => sum + item.amount, 0);
  });

  /** Total abonos del período seleccionado */
  readonly totalPayments = computed<number>(() => {
    return this.filteredPayments().reduce((sum, item) => sum + item.amount, 0);
  });

  /**
   * Deuda Pendiente TC (Saldo real amortizado del período):
   */
  readonly pendingDebt = computed<number>(() => {
    return this.totalConsumptions() - this.totalPayments();
  });

  /** Desglose por responsable/persona para el período seleccionado */
  readonly personMetrics = computed<TcPersonMetrics[]>(() => {
    const year = this.year();
    const month = this.month();
    const day = this.day();

    const periodExpenses = this.tcExpenses().filter((exp) => {
      const [y, m, d] = exp.date.split('-').map(Number);
      const matchesYear = y === year;
      const matchesMonth = month === 'Todos' || m === month;
      const matchesDay = day === 'Todos' || d === day;
      return matchesYear && matchesMonth && matchesDay;
    });

    const periodPayments = this.payments().filter((p) => {
      const [y, m, d] = p.date.split('-').map(Number);
      const matchesYear = y === year;
      const matchesMonth = month === 'Todos' || m === month;
      const matchesDay = day === 'Todos' || d === day;
      return matchesYear && matchesMonth && matchesDay;
    });

    const totalCons = periodExpenses.reduce((sum, e) => sum + e.amount, 0);

    return EXPENSE_PERSONS.map((person: ExpensePerson) => {
      const consumptions = periodExpenses
        .filter((e) => e.person === person)
        .reduce((sum, e) => sum + e.amount, 0);

      const payments = periodPayments
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

  setYear(year: number): void {
    this.year.set(year);
  }

  setMonth(month: MonthFilter): void {
    this.month.set(month);
  }

  setDay(day: DayFilter): void {
    this.day.set(day);
  }

  setPerson(person: ExpensePersonFilter): void {
    this.person.set(person);
  }

  setPersonFilter(person: ExpensePersonFilter): void {
    this.person.set(person);
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
    this.lastLocalMutationTime = Date.now();
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
      this.toastService.success('Consumo de TC registrado');
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
        return;
      }
      this.toastService.success('Consumo de TC actualizado');
    } catch (err: any) {
      console.error('Error de red al actualizar consumo TC:', err);
    }
  }

  async deleteTcExpense(id: string): Promise<void> {
    const existing = this.tcExpenses().find((item) => item.id === id);

    // Actualización optimista
    this.tcExpenses.update((list) => {
      const updated = list.filter((item) => item.id !== id);
      this.saveToStorage(updated);
      return updated;
    });

    if (existing) {
      const backupDraft: TcExpenseDraft = {
        date: existing.date,
        person: existing.person,
        description: existing.description,
        amount: existing.amount,
        category: existing.category,
      };
      this.toastService.success('Consumo de TC eliminado', {
        label: 'Deshacer',
        onClick: () => {
          this.addTcExpense(backupDraft);
        },
      });
    }

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
          (payload: any) => {
            if (Date.now() - this.lastLocalMutationTime < 2500) {
              return;
            }
            this.loadTcExpenses();
            if (payload?.eventType === 'INSERT' && payload?.new) {
              this.pushNotificationService.notifyIncomingTcExpense(payload.new);
            }
          },
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription no disponible para tc_expenses:', err);
    }
  }
}
