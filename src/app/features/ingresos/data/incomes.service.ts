import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
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
  private readonly toastService = inject(ToastService);
  private readonly pushNotificationService = inject(PushNotificationService);

  private readonly incomes = signal<Income[]>([]);
  private lastLocalMutationTime = 0;
  readonly allIncomes = this.incomes.asReadonly();
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly year = signal<number>(new Date().getFullYear());
  readonly month = signal<MonthFilter>(new Date().getMonth() + 1);
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
      const cleanDate = (income.date || '').trim().split('T')[0];
      const matchesYear = Number(cleanDate.slice(0, 4)) === year;
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
        const cleanDate = (income.date || '').trim().split('T')[0];
        const [, m, d] = cleanDate.split('-').map(Number);
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
      const cleanDate = (income.date || '').trim().split('T')[0];
      const monthIndex = Number(cleanDate.slice(5, 7)) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        if (income.person === 'Benny') {
          series.benny[monthIndex] += income.amount;
        } else {
          series.charlie[monthIndex] += income.amount;
        }
        series.total[monthIndex] += income.amount;
      }
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

  async loadIncomes(showLoading: boolean = true): Promise<void> {
    if (showLoading) {
      this.loading.set(true);
    }
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
      if (showLoading) {
        this.loading.set(false);
      }
    }
  }

  async addIncome(draft: IncomeDraft): Promise<void> {
    this.lastLocalMutationTime = Date.now();
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
        this.incomes.update((list) => list.filter((inc) => inc.id !== tempId));
        return;
      }

      if (data) {
        // Reemplazar el ID temporal en el objeto en silencio sin recrear el array
        const found = this.incomes().find((inc) => inc.id === tempId);
        if (found) {
          found.id = String(data.id);
        }
      }
      this.toastService.success('Ingreso registrado exitosamente');
      this.pushNotificationService.handleIncomeCreated(draft);
    } catch (err: any) {
      console.error('Error de red insertando en Supabase:', err);
    }
  }

  async updateIncome(id: string, draft: IncomeDraft): Promise<void> {
    this.lastLocalMutationTime = Date.now();
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
        return;
      }
      this.toastService.success('Ingreso actualizado correctamente');
    } catch (err: any) {
      console.error('Error de red actualizando en Supabase:', err);
    }
  }

  async deleteIncome(id: string): Promise<void> {
    this.lastLocalMutationTime = Date.now();
    const existing = this.incomes().find((inc) => inc.id === id);

    // Actualización optimista local inmediata
    this.incomes.update((list) => list.filter((income) => income.id !== id));

    if (existing) {
      const backupDraft: IncomeDraft = {
        date: existing.date,
        person: existing.person,
        source: existing.source,
        description: existing.description,
        amount: existing.amount,
      };
      this.pushNotificationService.handleIncomeDeleted(existing);
      this.toastService.success('Ingreso eliminado', {
        label: 'Deshacer',
        onClick: () => {
          this.addIncome(backupDraft);
        },
      });
    }

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
    const proc = (globalThis as any).process;
    if (proc?.env?.['NODE_ENV'] === 'test' || proc?.env?.['VITEST']) {
      return;
    }

    try {
      this.supabase.client
        .channel('public:incomes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'incomes' },
          (payload: any) => {
            if (Date.now() - this.lastLocalMutationTime < 2500) {
              return;
            }
            this.loadIncomes(false);
            if (payload?.eventType === 'INSERT' && payload?.new) {
              this.pushNotificationService.notifyIncomingIncome(payload.new);
            } else if (payload?.eventType === 'DELETE' && payload?.old) {
              this.pushNotificationService.notifyIncomingIncomeDeleted(payload.old);
            }
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
