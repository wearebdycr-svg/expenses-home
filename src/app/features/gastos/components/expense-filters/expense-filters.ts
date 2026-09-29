import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Select, type SelectOption } from '../../../../shared/ui/select/select';
import {
  EXPENSE_PERSONS,
  MONTHS,
  YEARS,
  formatCOP,
  type ExpensePersonFilter,
} from '../../data/expense.model';
import {
  ExpensesService,
  type DayFilter,
  type MonthFilter,
} from '../../data/expenses.service';

const TODOS_MONTH: SelectOption<MonthFilter> = { value: 'Todos', label: 'Todos' };
const TODOS_DAY: SelectOption<DayFilter> = { value: 'Todos', label: 'Todos' };

@Component({
  selector: 'app-expense-filters',
  imports: [Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expense-filters.html',
  styleUrl: './expense-filters.css',
})
export class ExpenseFilters {
  protected readonly expensesService = inject(ExpensesService);
  protected readonly formatCOP = formatCOP;

  protected readonly yearOptions: readonly SelectOption<number>[] = YEARS.map((year) => ({
    value: year,
    label: String(year),
  }));

  protected readonly monthOptions: readonly SelectOption<MonthFilter>[] = [
    TODOS_MONTH,
    ...MONTHS.map((name, index) => ({ value: index + 1, label: name })),
  ];

  protected readonly dayOptions: readonly SelectOption<DayFilter>[] = [
    TODOS_DAY,
    ...Array.from({ length: 31 }, (_, index) => ({ value: index + 1, label: String(index + 1) })),
  ];

  protected readonly personOptions: readonly SelectOption<ExpensePersonFilter>[] = [
    { value: 'Todos', label: 'Todos' },
    ...EXPENSE_PERSONS.map((person) => ({ value: person, label: person })),
  ];
}
