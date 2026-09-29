import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Select, type SelectOption } from '../../../../shared/ui/select/select';
import {
  EXPENSE_PERSONS,
  MONTHS,
  YEARS,
  formatCOP,
  type DayFilter,
  type ExpensePersonFilter,
  type MonthFilter,
} from '../../data/categoria.model';
import { CategoriaService } from '../../data/categoria.service';

const TODOS_MONTH: SelectOption<MonthFilter> = { value: 'Todos', label: 'Todos' };
const TODOS_DAY: SelectOption<DayFilter> = { value: 'Todos', label: 'Todos' };

@Component({
  selector: 'app-categoria-filters',
  standalone: true,
  imports: [Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categoria-filters.html',
  styleUrl: './categoria-filters.css',
})
export class CategoriaFilters {
  protected readonly categoriaService = inject(CategoriaService);
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
