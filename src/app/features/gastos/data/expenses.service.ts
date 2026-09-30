import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import type {
  Expense,
  ExpenseCategory,
  ExpenseDraft,
  ExpensePerson,
  ExpensePersonFilter,
} from './expense.model';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_COLORS,
  generateExpenseId,
  getExpenseCategoryColor,
} from './expense.model';

export type MonthFilter = 'Todos' | number;
export type DayFilter = 'Todos' | number;

export interface DailyExpenseSeries {
  days: number[];
  benny: number[];
  charlie: number[];
  compartido: number[];
  total: number[];
}

export interface CategoryBreakdownItem {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
  color: string;
}

function emptyDailySeries(daysInMonth: number = 31): DailyExpenseSeries {
  return {
    days: Array.from({ length: daysInMonth }, (_, i) => i + 1),
    benny: Array(daysInMonth).fill(0),
    charlie: Array(daysInMonth).fill(0),
    compartido: Array(daysInMonth).fill(0),
    total: Array(daysInMonth).fill(0),
  };
}

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly supabase = inject(SupabaseService);

  private readonly expenses = signal<Expense[]>([]);
  private lastLocalMutationTime = 0;
  readonly allExpenses = this.expenses.asReadonly();
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly year = signal<number>(new Date().getFullYear());
  readonly month = signal<MonthFilter>(new Date().getMonth() + 1);
  readonly day = signal<DayFilter>('Todos');
  readonly person = signal<ExpensePersonFilter>('Todos');

  constructor() {
    this.loadExpenses();
    this.setupRealtime();
  }

  /** Gastos del año y mes seleccionado (para las gráficas diarias y de categorías) */
  readonly monthlyExpenses = computed(() => {
    const year = this.year();
    const month = this.month();
    const person = this.person();

    return this.expenses().filter((expense) => {
      const [y, m] = expense.date.split('-').map(Number);
      const matchesYear = y === year;
      const matchesMonth = month === 'Todos' || m === month;
      const matchesPerson = person === 'Todos' || expense.person === person;
      return matchesYear && matchesMonth && matchesPerson;
    });
  });

  /** Gastos con todos los filtros aplicados (año, mes, día, persona), ordenados por fecha descendente (para la tabla) */
  readonly filteredExpenses = computed(() => {
    const day = this.day();

    return this.monthlyExpenses()
      .filter((expense) => {
        const [, , d] = expense.date.split('-').map(Number);
        return day === 'Todos' || d === day;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  /** Total consolidado del período filtrado (para el KPI superior) */
  readonly totalPeriod = computed(() =>
    this.filteredExpenses().reduce((sum, item) => sum + item.amount, 0),
  );

  /** Cantidad de transacciones filtradas (para el KPI superior) */
  readonly transactionCount = computed(() => this.filteredExpenses().length);

  /** Serie de gastos por día para la gráfica de barras apiladas */
  readonly dailySeries = computed<DailyExpenseSeries>(() => {
    const month = this.month();
    const year = this.year();
    const daysInMonth = month === 'Todos' ? 31 : new Date(year, Number(month), 0).getDate();
    const series = emptyDailySeries(daysInMonth);

    for (const exp of this.monthlyExpenses()) {
      const dayNum = Number(exp.date.split('-')[2]);
      if (dayNum >= 1 && dayNum <= daysInMonth) {
        const idx = dayNum - 1;
        if (exp.person === 'Benny') {
          series.benny[idx] += exp.amount;
        } else if (exp.person === 'Charlie') {
          series.charlie[idx] += exp.amount;
        } else if (exp.person === 'Compartido') {
          series.compartido[idx] += exp.amount;
        }
        series.total[idx] += exp.amount;
      }
    }

    return series;
  });

  /** Desglose por categoría para la gráfica de dona y su leyenda */
  readonly categoryBreakdown = computed<CategoryBreakdownItem[]>(() => {
    const list = this.filteredExpenses();
    const total = list.reduce((sum, item) => sum + item.amount, 0);

    const totalsByCategory = new Map<ExpenseCategory, number>();
    for (const cat of EXPENSE_CATEGORIES) {
      totalsByCategory.set(cat, 0);
    }

    for (const exp of list) {
      const current = totalsByCategory.get(exp.category) ?? 0;
      totalsByCategory.set(exp.category, current + exp.amount);
    }

    const items: CategoryBreakdownItem[] = [];
    totalsByCategory.forEach((amount, category) => {
      if (amount > 0) {
        items.push({
          category,
          amount,
          percentage: total > 0 ? (amount / total) * 100 : 0,
          color: getExpenseCategoryColor(category),
        });
      }
    });

    // Ordenar de mayor a menor monto
    return items.sort((a, b) => b.amount - a.amount);
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

  async loadExpenses(showLoading: boolean = true): Promise<void> {
    if (showLoading) {
      this.loading.set(true);
    }
    try {
      const { data, error } = await this.supabase.client
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.warn(
          'Supabase: No se pudieron cargar los gastos (verifica si la tabla expenses existe en Supabase):',
          error.message,
        );
        this.error.set(error.message);
        return;
      }

      if (data) {
        const mapped: Expense[] = data.map((item: any) => ({
          id: String(item.id),
          date: String(item.date),
          person: item.person as ExpensePerson,
          category: item.category as ExpenseCategory,
          description: String(item.description),
          amount: Number(item.amount),
        }));
        this.expenses.set(mapped);
        this.error.set(null);
      }
    } catch (err: any) {
      console.warn('Error de conexión a Supabase:', err);
      this.error.set(err?.message ?? 'Error inesperado de conexión');
    } finally {
      if (showLoading) {
        this.loading.set(false);
      }
    }
  }

  async addExpense(draft: ExpenseDraft): Promise<void> {
    this.lastLocalMutationTime = Date.now();
    const tempId = generateExpenseId();
    const optimisticExpense: Expense = { ...draft, id: tempId };

    // Actualización optimista local inmediata (un solo renderizado limpio)
    this.expenses.update((list) => [optimisticExpense, ...list]);

    try {
      const { data, error } = await this.supabase.client
        .from('expenses')
        .insert([
          {
            date: draft.date,
            person: draft.person,
            category: draft.category,
            description: draft.description,
            amount: draft.amount,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error insertando gasto en Supabase:', error);
        this.error.set(error.message);
        // Revertir optimista si falló
        this.expenses.update((list) => list.filter((exp) => exp.id !== tempId));
        return;
      }

      if (data) {
        // Actualizar id en silencio en el objeto existente sin recrear el array para evitar saltos visuales en gráficos
        const found = this.expenses().find((exp) => exp.id === tempId);
        if (found) {
          found.id = String(data.id);
        }
      }
    } catch (err: any) {
      console.error('Error de red al insertar gasto:', err);
    }
  }

  async updateExpense(id: string, draft: ExpenseDraft): Promise<void> {
    this.lastLocalMutationTime = Date.now();
    // Actualización optimista local inmediata
    this.expenses.update((list) =>
      list.map((exp) => (exp.id === id ? { ...draft, id } : exp)),
    );

    try {
      const { error } = await this.supabase.client
        .from('expenses')
        .update({
          date: draft.date,
          person: draft.person,
          category: draft.category,
          description: draft.description,
          amount: draft.amount,
        })
        .eq('id', id);

      if (error) {
        console.error('Error actualizando gasto en Supabase:', error);
        this.error.set(error.message);
      }
    } catch (err: any) {
      console.error('Error de red al actualizar gasto:', err);
    }
  }

  async deleteExpense(id: string): Promise<void> {
    this.lastLocalMutationTime = Date.now();
    // Actualización optimista local inmediata
    this.expenses.update((list) => list.filter((exp) => exp.id !== id));

    try {
      const { error } = await this.supabase.client
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error eliminando gasto en Supabase:', error);
        this.error.set(error.message);
      }
    } catch (err: any) {
      console.error('Error de red al eliminar gasto:', err);
    }
  }

  /**
   * Actualización en cascada: Cuando se renombra una deuda,
   * se actualizan todos los gastos asociados que tengan esa categoría.
   */
  async renameCategory(oldName: string, newName: string): Promise<void> {
    const current = this.expenses();
    const hasMatches = current.some((e) => e.category === oldName);
    if (!hasMatches) return;

    const updated = current.map((e) =>
      e.category === oldName ? { ...e, category: newName } : e,
    );
    this.expenses.set(updated);

    try {
      const { error } = await this.supabase.client
        .from('expenses')
        .update({ category: newName })
        .eq('category', oldName);

      if (error) {
        console.warn('Error al actualizar categoría en cascada en Supabase:', error.message);
      }
    } catch (err: any) {
      console.warn('Error de red al actualizar categoría en cascada:', err);
    }
  }

  private setupRealtime(): void {
    const proc = (globalThis as any).process;
    if (proc?.env?.['NODE_ENV'] === 'test' || proc?.env?.['VITEST']) {
      return;
    }

    try {
      this.supabase.client
        .channel('public:expenses')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'expenses' },
          () => {
            // Ignorar eventos de eco causados por mutaciones de este mismo cliente para no recrear los gráficos
            if (Date.now() - this.lastLocalMutationTime < 2500) {
              return;
            }
            this.loadExpenses(false);
          },
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription no disponible para expenses:', err);
    }
  }
}
