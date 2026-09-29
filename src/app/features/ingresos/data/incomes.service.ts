import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import type { Income, IncomeDraft, IncomeSource, Person, PersonFilter } from './income.model';
import { generateId } from './income.model';

export type MonthFilter = 'Todos' | number;
export type DayFilter = 'Todos' | number;

export interface IncomeTotals {
  benny: number;
  charlie: number;
  total: number;
}

export interface MonthlySeries {
  benny: number[];
  charlie: number[];
  total: number[];
}

function emptyMonthlySeries(): MonthlySeries {
  return { benny: Array(12).fill(0), charlie: Array(12).fill(0), total: Array(12).fill(0) };
}

/**
 * Servicio reactivo para Ingresos conectado a Supabase con sincronización en tiempo real
 * y actualización optimista local inmediata para máxima fluidez en la interfaz.
 */
@Injectable({ providedIn: 'root' })
export class IncomesService {
  private readonly supabase = inject(SupabaseService);

  private readonly incomes = signal<Income[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly year = signal<number>(new Date().getFullYear());
  readonly month = signal<MonthFilter>('Todos');
  readonly day = signal<DayFilter>('Todos');
  readonly person = signal<PersonFilter>('Todos');

  constructor() {
    this.loadIncomes();
    this.setupRealtime();
  }

  /** Ingresos del año + persona seleccionados, sin filtrar por mes/día (para las gráficas). */
  readonly yearlyIncomes = computed(() => {
    const year = this.year();
    const person = this.person();
    return this.incomes().filter((income) => {
      const matchesYear = Number(income.date.slice(0, 4)) === year;
      const matchesPerson = person === 'Todos' || income.person === person;
      return matchesYear && matchesPerson;
    });
  });

  /** Ingresos con todos los filtros aplicados, ordenados por fecha descendente (para la tabla). */
  readonly filteredIncomes = computed(() => {
    const month = this.month();
    const day = this.day();
    return this.yearlyIncomes()
      .filter((income) => {
        const [, m, d] = income.date.split('-').map(Number);
        const matchesMonth = month === 'Todos' || m === month;
        const matchesDay = day === 'Todos' || d === day;
        return matchesMonth && matchesDay;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  readonly totals = computed<IncomeTotals>(() => this.sumByPerson(this.filteredIncomes()));

  readonly chartTotals = computed<IncomeTotals>(() => this.sumByPerson(this.yearlyIncomes()));

  /** Series mensuales (índice 0 = enero) para las gráficas de barras y de tendencia. */
  readonly monthlySeries = computed<MonthlySeries>(() => {
    const series = emptyMonthlySeries();
    for (const income of this.yearlyIncomes()) {
      const monthIndex = Number(income.date.slice(5, 7)) - 1;
      if (income.person === 'Benny') {
        series.benny[monthIndex] += income.amount;
      } else {
        series.charlie[monthIndex] += income.amount;
      }
      series.total[monthIndex] += income.amount;
    }
    return series;
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

  setPerson(person: PersonFilter): void {
    this.person.set(person);
  }

  async loadIncomes(): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('incomes')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.warn(
          'Supabase: No se pudieron cargar los ingresos (verifica si la tabla existe en Supabase):',
          error.message
        );
        this.error.set(error.message);
        return;
      }

      if (data) {
        const mapped: Income[] = data.map((item: any) => ({
          id: String(item.id),
          date: String(item.date),
          person: item.person as Person,
          source: item.source as IncomeSource,
          description: String(item.description),
          amount: Number(item.amount),
        }));
        this.incomes.set(mapped);
        this.error.set(null);
      }
    } catch (err: any) {
      console.warn('Error conectando a Supabase:', err);
      this.error.set(err?.message ?? 'Error inesperado de conexión');
    } finally {
      this.loading.set(false);
    }
  }

  async addIncome(draft: IncomeDraft): Promise<void> {
    const tempId = generateId();
    const optimisticIncome: Income = { ...draft, id: tempId };

    // Actualización optimista local inmediata
    this.incomes.update((list) => [optimisticIncome, ...list]);

    try {
      const { data, error } = await this.supabase.client
        .from('incomes')
        .insert([
          {
            date: draft.date,
            person: draft.person,
            source: draft.source,
            description: draft.description,
            amount: draft.amount,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error insertando en Supabase:', error);
        this.error.set(error.message);
        return;
      }

      if (data) {
        // Reemplazar el ID temporal con el asignado por Supabase
        this.incomes.update((list) =>
          list.map((inc) => (inc.id === tempId ? { ...inc, id: String(data.id) } : inc))
        );
      }
    } catch (err: any) {
      console.error('Error de red insertando en Supabase:', err);
    }
  }

  async updateIncome(id: string, draft: IncomeDraft): Promise<void> {
    // Actualización optimista local inmediata
    this.incomes.update((list) =>
      list.map((income) => (income.id === id ? { ...draft, id } : income))
    );

    try {
      const { error } = await this.supabase.client
        .from('incomes')
        .update({
          date: draft.date,
          person: draft.person,
          source: draft.source,
          description: draft.description,
          amount: draft.amount,
        })
        .eq('id', id);

      if (error) {
        console.error('Error actualizando en Supabase:', error);
        this.error.set(error.message);
      }
    } catch (err: any) {
      console.error('Error de red actualizando en Supabase:', err);
    }
  }

  async deleteIncome(id: string): Promise<void> {
    // Actualización optimista local inmediata
    this.incomes.update((list) => list.filter((income) => income.id !== id));

    try {
      const { error } = await this.supabase.client
        .from('incomes')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error eliminando en Supabase:', error);
        this.error.set(error.message);
      }
    } catch (err: any) {
      console.error('Error de red eliminando en Supabase:', err);
    }
  }

  private setupRealtime(): void {
    try {
      this.supabase.client
        .channel('public:incomes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'incomes' },
          () => {
            this.loadIncomes();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription no disponible:', err);
    }
  }

  private sumByPerson(incomes: readonly Income[]): IncomeTotals {
    let benny = 0;
    let charlie = 0;
    for (const income of incomes) {
      if (income.person === 'Benny') {
        benny += income.amount;
      } else {
        charlie += income.amount;
      }
    }
    return { benny, charlie, total: benny + charlie };
  }
}
