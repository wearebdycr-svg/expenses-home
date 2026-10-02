import { Injectable, computed, inject, signal } from '@angular/core';
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

@Injectable({ providedIn: 'root' })
export class ResumenService {
  private readonly incomesService = inject(IncomesService);
  private readonly expensesService = inject(ExpensesService);

  readonly year = signal<number>(new Date().getFullYear());
  readonly person = signal<ResumenPerson>('Todos');

  setYear(year: number): void {
    this.year.set(year);
  }

  setPerson(person: ResumenPerson): void {
    this.person.set(person);
  }

  /**
   * Genera las 12 filas mensuales (Enero a Diciembre) del año seleccionado,
   * calculando ingresos por persona, gastos por persona/compartido, balance y acumulado.
   */
  readonly summaryRows = computed<MonthlySummaryRow[]>(() => {
    const targetYear = this.year();
    const filterPerson = this.person();

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
