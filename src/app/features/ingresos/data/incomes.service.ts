import { Injectable, computed, signal } from '@angular/core';
import type { Income, IncomeDraft, PersonFilter } from './income.model';
import { generateId } from './income.model';
import { INCOME_SEED } from './incomes.seed';

export type MonthFilter = 'Todos' | number;
export type DayFilter = 'Todos' | number;

export interface IncomeTotals {
  ana: number;
  carlos: number;
  total: number;
}

export interface MonthlySeries {
  ana: number[];
  carlos: number[];
  total: number[];
}

function emptyMonthlySeries(): MonthlySeries {
  return { ana: Array(12).fill(0), carlos: Array(12).fill(0), total: Array(12).fill(0) };
}

/**
 * Fuente de datos en memoria para Ingresos. Expone la misma forma de datos
 * que tendría un backend real (lista de Income + operaciones CRUD), para que
 * cambiar esta implementación por llamadas HttpClient no requiera tocar los
 * componentes que consumen el servicio.
 */
@Injectable({ providedIn: 'root' })
export class IncomesService {
  private readonly incomes = signal<Income[]>([...INCOME_SEED]);

  readonly year = signal<number>(2026);
  readonly month = signal<MonthFilter>('Todos');
  readonly day = signal<DayFilter>('Todos');
  readonly person = signal<PersonFilter>('Todos');

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
      if (income.person === 'Ana') {
        series.ana[monthIndex] += income.amount;
      } else {
        series.carlos[monthIndex] += income.amount;
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

  addIncome(draft: IncomeDraft): void {
    this.incomes.update((list) => [...list, { ...draft, id: generateId() }]);
  }

  updateIncome(id: string, draft: IncomeDraft): void {
    this.incomes.update((list) => list.map((income) => (income.id === id ? { ...draft, id } : income)));
  }

  deleteIncome(id: string): void {
    this.incomes.update((list) => list.filter((income) => income.id !== id));
  }

  private sumByPerson(incomes: readonly Income[]): IncomeTotals {
    let ana = 0;
    let carlos = 0;
    for (const income of incomes) {
      if (income.person === 'Ana') {
        ana += income.amount;
      } else {
        carlos += income.amount;
      }
    }
    return { ana, carlos, total: ana + carlos };
  }
}
