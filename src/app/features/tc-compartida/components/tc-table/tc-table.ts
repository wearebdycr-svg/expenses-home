import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Icon } from '../../../../shared/ui/icon/icon';
import { Select, type SelectOption } from '../../../../shared/ui/select/select';
import { TcService } from '../../data/tc.service';
import {
  EXPENSE_PERSON_COLORS,
  formatCOP,
  formatDisplayDate,
  type ExpensePersonFilter,
  type TcExpense,
} from '../../data/tc.model';

@Component({
  selector: 'app-tc-table',
  standalone: true,
  imports: [CommonModule, Icon, Badge, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tc-table.html',
  styleUrl: './tc-table.css',
})
export class TcTable {
  protected readonly tcService = inject(TcService);

  edit = output<TcExpense>();
  delete = output<TcExpense>();

  protected readonly personColors = EXPENSE_PERSON_COLORS;

  protected readonly personFilterOptions: readonly SelectOption<ExpensePersonFilter>[] = [
    { value: 'Todos', label: 'Todos' },
    { value: 'Benny', label: 'Benny' },
    { value: 'Charlie', label: 'Charlie' },
    { value: 'Compartido', label: 'Compartido' },
  ];

  protected formatDisplayDate(isoDate: string): string {
    return formatDisplayDate(isoDate);
  }

  protected formatCOP(amount: number): string {
    return formatCOP(amount);
  }

  protected onPersonFilterChange(val: ExpensePersonFilter): void {
    this.tcService.setPersonFilter(val);
  }

  protected onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.tcService.setSearchQuery(input.value);
  }

  protected onEdit(expense: TcExpense): void {
    this.edit.emit(expense);
  }

  protected onDelete(expense: TcExpense): void {
    const confirmed = window.confirm(
      `¿Deseas eliminar el consumo "${expense.description}" por ${formatCOP(expense.amount)}?`,
    );
    if (confirmed) {
      this.delete.emit(expense);
    }
  }
}
