import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Select, type SelectOption } from '../../../../shared/ui/select/select';
import {
  MONTHS,
  PERSON_COLORS,
  TOTAL_COLOR,
  YEARS,
  formatCOP,
  type PersonFilter,
} from '../../data/income.model';
import { IncomesService, type DayFilter, type MonthFilter } from '../../data/incomes.service';

const TODOS_MONTH: SelectOption<MonthFilter> = { value: 'Todos', label: 'Todos' };
const TODOS_DAY: SelectOption<DayFilter> = { value: 'Todos', label: 'Todos' };

@Component({
  selector: 'app-income-filters',
  imports: [Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './income-filters.html',
  styleUrl: './income-filters.css',
})
export class IncomeFilters {
  protected readonly incomesService = inject(IncomesService);

  protected readonly formatCOP = formatCOP;
  protected readonly personColors = PERSON_COLORS;
  protected readonly totalColor = TOTAL_COLOR;

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

  protected readonly personOptions: readonly SelectOption<PersonFilter>[] = [
    { value: 'Todos', label: 'Todos' },
    { value: 'Ana', label: 'Ana' },
    { value: 'Carlos', label: 'Carlos' },
  ];
}
