import { Injectable, computed, inject, signal } from '@angular/core';
import { RemoteConfigService } from '../../../core/services/remote-config.service';
import { ExpensesService } from '../../gastos/data/expenses.service';
import type {
  BudgetStatus,
  CategoryTableRow,
  DayFilter,
  ExpenseCategory,
  ExpensePersonFilter,
  LegendCategoryItem,
  MonthFilter,
} from './categoria.model';
import {
  CATEGORY_COLORS,
  MEMBER_COLORS,
  getCategoryColor,
} from './categoria.model';

@Injectable({ providedIn: 'root' })
export class CategoriaService {
  private readonly expensesService = inject(ExpensesService);
  private readonly remoteConfig = inject(RemoteConfigService);

  readonly alertThresholdPct = computed(() => this.remoteConfig.alertThresholdPct());
  readonly budgetsByCategory = this.remoteConfig.budgetsByCategory;

  readonly year = signal<number>(new Date().getFullYear());
  readonly month = signal<MonthFilter>('Todos');
  readonly day = signal<DayFilter>('Todos');
  readonly person = signal<ExpensePersonFilter>('Todos');

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

  /**
   * Gastos filtrados por año, mes, día y persona
   */
  readonly filteredExpenses = computed(() => {
    const year = this.year();
    const month = this.month();
    const day = this.day();
    const person = this.person();

    return this.expensesService.allExpenses().filter((exp) => {
      const [y, m, d] = exp.date.split('-').map(Number);
      const matchesYear = y === year;
      const matchesMonth = month === 'Todos' || m === month;
      const matchesDay = day === 'Todos' || d === day;
      const matchesPerson = person === 'Todos' || exp.person === person;
      return matchesYear && matchesMonth && matchesDay && matchesPerson;
    });
  });

  /**
   * Total acumulado de gastos en el período filtrado
   */
  readonly totalPeriod = computed<number>(() =>
    this.filteredExpenses().reduce((sum, item) => sum + item.amount, 0),
  );

  /**
   * Filas por categoría agrupadas y ordenadas de mayor a menor monto total
   */
  readonly categoryRows = computed<CategoryTableRow[]>(() => {
    const expenses = this.filteredExpenses();
    const total = this.totalPeriod();

    const categoryMap = new Map<
      ExpenseCategory,
      { benny: number; charlie: number; compartido: number; total: number; count: number }
    >();

    for (const exp of expenses) {
      let entry = categoryMap.get(exp.category);
      if (!entry) {
        entry = { benny: 0, charlie: 0, compartido: 0, total: 0, count: 0 };
        categoryMap.set(exp.category, entry);
      }
      if (exp.person === 'Benny') entry.benny += exp.amount;
      else if (exp.person === 'Charlie') entry.charlie += exp.amount;
      else if (exp.person === 'Compartido') entry.compartido += exp.amount;

      entry.total += exp.amount;
      entry.count += 1;
    }

    const threshold = this.alertThresholdPct();
    const rows: CategoryTableRow[] = [];
    categoryMap.forEach((entry, cat) => {
      const budget = this.remoteConfig.getBudgetForCategory(cat);
      let budgetPercentage: number | null = null;
      let budgetStatus: BudgetStatus = 'none';
      let statusColor = getCategoryColor(cat);

      if (budget != null && budget > 0) {
        budgetPercentage = (entry.total / budget) * 100;
        if (budgetPercentage >= 100) {
          budgetStatus = 'exceeded';
          statusColor = '#ef4444'; // Consumo ≥ 100%: Rojo (Excedido)
        } else if (budgetPercentage >= threshold) {
          budgetStatus = 'warning';
          statusColor = '#f59e0b'; // Consumo ≥ 80%: Ámbar / Naranja (Preventivo)
        } else {
          budgetStatus = 'normal';
          statusColor = getCategoryColor(cat); // Consumo < 80%: Color normal
        }
      }

      rows.push({
        category: cat,
        color: getCategoryColor(cat),
        benny: entry.benny,
        charlie: entry.charlie,
        compartido: entry.compartido,
        total: entry.total,
        percentage: total > 0 ? (entry.total / total) * 100 : 0,
        transactionCount: entry.count,
        budget,
        budgetPercentage,
        budgetStatus,
        statusColor,
      });
    });

    return rows.sort((a, b) => b.total - a.total);
  });

  /**
   * Cantidad de categorías con al menos una transacción registrada
   */
  readonly categoriesCount = computed<number>(() => this.categoryRows().length);

  /**
   * Ítems de la leyenda de la dona interactiva
   */
  readonly donutLegendItems = computed<LegendCategoryItem[]>(() =>
    this.categoryRows().map((row) => ({
      category: row.category,
      color: row.color,
      percentage: row.percentage,
      amount: row.total,
    })),
  );

  /**
   * Datos para la gráfica de dona (Distribución Porcentual)
   */
  readonly donutChartData = computed(() => {
    const rows = this.categoryRows();
    return {
      labels: rows.map((r) => r.category),
      datasets: [
        {
          data: rows.map((r) => r.total),
          backgroundColor: rows.map((r) => r.color),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4,
        },
      ],
    };
  });

  /**
   * Datos para la gráfica de barras horizontales apiladas (Monto por categoría y persona)
   */
  readonly stackedBarChartData = computed(() => {
    const rows = this.categoryRows();
    return {
      labels: rows.map((r) => r.category),
      datasets: [
        {
          label: 'Benny',
          data: rows.map((r) => r.benny),
          backgroundColor: MEMBER_COLORS.Benny,
          borderRadius: 2,
          maxBarThickness: 16,
        },
        {
          label: 'Charlie',
          data: rows.map((r) => r.charlie),
          backgroundColor: MEMBER_COLORS.Charlie,
          borderRadius: 2,
          maxBarThickness: 16,
        },
        {
          label: 'Compartido',
          data: rows.map((r) => r.compartido),
          backgroundColor: MEMBER_COLORS.Compartido,
          borderRadius: 2,
          maxBarThickness: 16,
        },
      ],
    };
  });
}
