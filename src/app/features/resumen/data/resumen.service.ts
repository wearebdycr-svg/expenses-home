import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ExpensesService } from '../../gastos/data/expenses.service';
import { IncomesService } from '../../ingresos/data/incomes.service';
import type {
  MonthlySummaryRow,
  ResumenKPIs,
  ResumenPerson,
} from './resumen.model';
import {
  MONTHS,
  MONTH_ABBREVIATIONS,
} from './resumen.model';

export interface DbMonthlySummaryRow {
  year: number;
  month: number;
  income_benny: number;
  income_charlie: number;
  total_income: number;
  expense_benny: number;
  expense_charlie: number;
  expense_compartido: number;
  total_expense: number;
  balance: number;
  savings_rate: number;
}

@Injectable({ providedIn: 'root' })
export class ResumenService {
  private readonly supabase = inject(SupabaseService);
  private readonly incomesService = inject(IncomesService);
  private readonly expensesService = inject(ExpensesService);

  readonly year = signal<number>(new Date().getFullYear());
  readonly person = signal<ResumenPerson>('Todos');
  readonly dbRows = signal<Record<number, DbMonthlySummaryRow> | null>(null);
  readonly loading = signal<boolean>(false);

  constructor() {
    this.loadFromView();
  }

  setYear(year: number): void {
    this.year.set(year);
    this.loadFromView(year);
  }

  setPerson(person: ResumenPerson): void {
    this.person.set(person);
  }

  /**
   * Carga los datos consolidados directamente de la vista SQL de Supabase (Fase 2)
   */
  async loadFromView(year: number = this.year()): Promise<void> {
    try {
      this.loading.set(true);
      const { data, error } = await this.supabase.client
        .from('v_monthly_summary')
        .select('*')
        .eq('year', year);

      if (!error && data && data.length > 0) {
        const map: Record<number, DbMonthlySummaryRow> = {};
        for (const item of data) {
          map[Number(item.month)] = {
            year: Number(item.year),
            month: Number(item.month),
            income_benny: Number(item.income_benny) || 0,
            income_charlie: Number(item.income_charlie) || 0,
            total_income: Number(item.total_income) || 0,
            expense_benny: Number(item.expense_benny) || 0,
            expense_charlie: Number(item.expense_charlie) || 0,
            expense_compartido: Number(item.expense_compartido) || 0,
            total_expense: Number(item.total_expense) || 0,
            balance: Number(item.balance) || 0,
            savings_rate: Number(item.savings_rate) || 0,
          };
        }
        this.dbRows.set(map);
      } else {
        this.dbRows.set(null);
      }
    } catch {
      this.dbRows.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Genera las 12 filas mensuales (Enero a Diciembre) del año seleccionado.
   * Utiliza la vista SQL de Supabase si está disponible; en caso contrario,
   * utiliza el cálculo local en memoria (fallback resiliente).
   */
  readonly summaryRows = computed<MonthlySummaryRow[]>(() => {
    const targetYear = this.year();
    const filterPerson = this.person();
    const dbData = this.dbRows();

    // 1. ACELERACIÓN POR BASE DE DATOS: Si la vista SQL entregó datos preagrupados
    if (dbData && Object.keys(dbData).length > 0) {
      let runningCumulativeBalance = 0;
      const rows: MonthlySummaryRow[] = [];

      for (let m = 1; m <= 12; m++) {
        const dbMonth = dbData[m];
        const incomeBenny = dbMonth?.income_benny ?? 0;
        const incomeCharlie = dbMonth?.income_charlie ?? 0;
        const expenseBenny = dbMonth?.expense_benny ?? 0;
        const expenseCharlie = dbMonth?.expense_charlie ?? 0;
        const expenseCompartido = dbMonth?.expense_compartido ?? 0;

        let totalIncome = 0;
        if (filterPerson === 'Todos') totalIncome = incomeBenny + incomeCharlie;
        else if (filterPerson === 'Benny') totalIncome = incomeBenny;
        else if (filterPerson === 'Charlie') totalIncome = incomeCharlie;

        let totalExpense = 0;
        if (filterPerson === 'Todos') totalExpense = expenseBenny + expenseCharlie + expenseCompartido;
        else if (filterPerson === 'Benny') totalExpense = expenseBenny;
        else if (filterPerson === 'Charlie') totalExpense = expenseCharlie;
        else if (filterPerson === 'Compartido') totalExpense = expenseCompartido;

        const hasData = dbMonth != null && (incomeBenny > 0 || incomeCharlie > 0 || expenseBenny > 0 || expenseCharlie > 0 || expenseCompartido > 0);
        const balance = totalIncome - totalExpense;

        if (hasData) {
          runningCumulativeBalance += balance;
        }

        const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
        const monthTotalIncome = incomeBenny + incomeCharlie;
        const monthTotalExpense = expenseBenny + expenseCharlie + expenseCompartido;
        const monthBalance = monthTotalIncome - monthTotalExpense;
        const monthSavingsRate = monthTotalIncome > 0 ? (monthBalance / monthTotalIncome) * 100 : 0;

        rows.push({
          month: m,
          monthName: MONTHS[m - 1],
          monthAbbr: MONTH_ABBREVIATIONS[m - 1],
          hasData,
          incomeBenny,
          incomeCharlie,
          totalIncome,
          expenseBenny,
          expenseCharlie,
          expenseCompartido,
          totalExpense,
          balance,
          cumulativeBalance: runningCumulativeBalance,
          savingsRate,
          monthTotalIncome,
          monthTotalExpense,
          monthBalance,
          monthSavingsRate,
        });
      }
      return rows;
    }

    const allIncomes = this.incomesService.allIncomes();
    const allExpenses = this.expensesService.allExpenses();

    let runningCumulativeBalance = 0;
    const rows: MonthlySummaryRow[] = [];

    for (let m = 1; m <= 12; m++) {
      const monthStr = String(m).padStart(2, '0');
      const yearMonthPrefix = `${targetYear}-${monthStr}`;

      // Filtrar ingresos del mes
      const monthIncomes = allIncomes.filter((inc) =>
        inc.date.startsWith(yearMonthPrefix),
      );

      let incomeBenny = 0;
      let incomeCharlie = 0;
      for (const inc of monthIncomes) {
        if (inc.person === 'Benny') incomeBenny += inc.amount;
        if (inc.person === 'Charlie') incomeCharlie += inc.amount;
      }

      // Aplicar filtro de persona a ingresos
      let totalIncome = 0;
      if (filterPerson === 'Todos') {
        totalIncome = incomeBenny + incomeCharlie;
      } else if (filterPerson === 'Benny') {
        totalIncome = incomeBenny;
      } else if (filterPerson === 'Charlie') {
        totalIncome = incomeCharlie;
      } else {
        totalIncome = 0; // 'Compartido' no tiene ingresos
      }

      // Filtrar gastos del mes
      const monthExpenses = allExpenses.filter((exp) =>
        exp.date.startsWith(yearMonthPrefix),
      );

      let expenseBenny = 0;
      let expenseCharlie = 0;
      let expenseCompartido = 0;
      for (const exp of monthExpenses) {
        if (exp.person === 'Benny') expenseBenny += exp.amount;
        else if (exp.person === 'Charlie') expenseCharlie += exp.amount;
        else if (exp.person === 'Compartido') expenseCompartido += exp.amount;
      }

      // Aplicar filtro de persona a gastos
      let totalExpense = 0;
      if (filterPerson === 'Todos') {
        totalExpense = expenseBenny + expenseCharlie + expenseCompartido;
      } else if (filterPerson === 'Benny') {
        totalExpense = expenseBenny;
      } else if (filterPerson === 'Charlie') {
        totalExpense = expenseCharlie;
      } else if (filterPerson === 'Compartido') {
        totalExpense = expenseCompartido;
      }

      const hasData = monthIncomes.length > 0 || monthExpenses.length > 0;
      const balance = totalIncome - totalExpense;

      if (hasData) {
        runningCumulativeBalance += balance;
      }

      const savingsRate =
        totalIncome > 0
          ? ((totalIncome - totalExpense) / totalIncome) * 100
          : 0;

      const monthTotalIncome = incomeBenny + incomeCharlie;
      const monthTotalExpense =
        expenseBenny + expenseCharlie + expenseCompartido;
      const monthBalance = monthTotalIncome - monthTotalExpense;
      const monthSavingsRate =
        monthTotalIncome > 0 ? (monthBalance / monthTotalIncome) * 100 : 0;

      rows.push({
        month: m,
        monthName: MONTHS[m - 1],
        monthAbbr: MONTH_ABBREVIATIONS[m - 1],
        hasData,
        incomeBenny,
        incomeCharlie,
        totalIncome,
        expenseBenny,
        expenseCharlie,
        expenseCompartido,
        totalExpense,
        balance,
        cumulativeBalance: runningCumulativeBalance,
        savingsRate,
        monthTotalIncome,
        monthTotalExpense,
        monthBalance,
        monthSavingsRate,
      });
    }

    return rows;
  });

  /**
   * Indicadores dinámicos superiores y KPIs de promedios y tasa de ahorro
   */
  readonly kpis = computed<ResumenKPIs>(() => {
    const rows = this.summaryRows();

    let totalIncomeYTD = 0;
    let totalExpenseYTD = 0;
    let monthsWithDataCount = 0;

    for (const r of rows) {
      totalIncomeYTD += r.totalIncome;
      totalExpenseYTD += r.totalExpense;
      if (r.hasData) {
        monthsWithDataCount++;
      }
    }

    const balanceYTD = totalIncomeYTD - totalExpenseYTD;
    const averageIncomeMonthly =
      monthsWithDataCount > 0
        ? Math.round(totalIncomeYTD / monthsWithDataCount)
        : 0;
    const averageExpenseMonthly =
      monthsWithDataCount > 0
        ? Math.round(totalExpenseYTD / monthsWithDataCount)
        : 0;
    const savingsRateYTD =
      totalIncomeYTD > 0
        ? ((totalIncomeYTD - totalExpenseYTD) / totalIncomeYTD) * 100
        : 0;

    return {
      totalIncomeYTD,
      totalExpenseYTD,
      balanceYTD,
      averageIncomeMonthly,
      averageExpenseMonthly,
      savingsRateYTD,
      monthsWithDataCount,
    };
  });

  /**
   * Serie mensual para el gráfico de barras agrupadas: Ingresos vs Gastos
   */
  readonly barChartSeries = computed(() => {
    const rows = this.summaryRows();
    return {
      labels: MONTH_ABBREVIATIONS,
      incomes: rows.map((r) => (r.hasData ? r.totalIncome : 0)),
      expenses: rows.map((r) => (r.hasData ? r.totalExpense : 0)),
    };
  });

  /**
   * Serie mensual para el gráfico de línea: Saldo acumulado en el año
   */
  readonly lineChartSeries = computed(() => {
    const rows = this.summaryRows();
    return {
      labels: MONTH_ABBREVIATIONS,
      cumulative: rows.map((r) => r.cumulativeBalance),
    };
  });
}
