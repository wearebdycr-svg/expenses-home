import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Icon } from '../../../../shared/ui/icon/icon';
import {
  EXPENSE_PERSON_COLORS,
  formatCOP,
  formatDisplayDate,
  type Expense,
} from '../../data/expense.model';
import { ExpensesService } from '../../data/expenses.service';

@Component({
  selector: 'app-expense-table',
  imports: [Badge, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expense-table.html',
  styleUrl: './expense-table.css',
})
export class ExpenseTable {
  private readonly expensesService = inject(ExpensesService);

  edit = output<Expense>();

  protected readonly expenses = this.expensesService.filteredExpenses;
  protected readonly personColors = EXPENSE_PERSON_COLORS;
  protected readonly formatCOP = formatCOP;
  protected readonly formatDisplayDate = formatDisplayDate;

  protected onEdit(expense: Expense): void {
    this.edit.emit(expense);
  }

  protected onDelete(expense: Expense): void {
    const confirmed = window.confirm(`¿Eliminar el gasto "${expense.description}"?`);
    if (confirmed) {
      this.expensesService.deleteExpense(expense.id);
    }
  }
}
