import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Icon } from '../../shared/ui/icon/icon';
import { ExpenseCategoryChart } from './components/expense-category-chart/expense-category-chart';
import { ExpenseDailyChart } from './components/expense-daily-chart/expense-daily-chart';
import { ExpenseFilters } from './components/expense-filters/expense-filters';
import { ExpenseFormModal } from './components/expense-form-modal/expense-form-modal';
import { ExpenseTable } from './components/expense-table/expense-table';
import type { Expense, ExpenseDraft } from './data/expense.model';
import { ExpensesService } from './data/expenses.service';

@Component({
  selector: 'app-gastos-page',
  imports: [
    Icon,
    ExpenseFilters,
    ExpenseDailyChart,
    ExpenseCategoryChart,
    ExpenseTable,
    ExpenseFormModal,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gastos.html',
  styleUrl: './gastos.css',
})
export class GastosPage {
  private readonly expensesService = inject(ExpensesService);

  protected readonly isModalOpen = signal(false);
  protected readonly editingExpense = signal<Expense | null>(null);

  protected openCreateModal(): void {
    this.editingExpense.set(null);
    this.isModalOpen.set(true);
  }

  protected openEditModal(expense: Expense): void {
    this.editingExpense.set(expense);
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected onSave(draft: ExpenseDraft): void {
    const editing = this.editingExpense();
    if (editing) {
      this.expensesService.updateExpense(editing.id, draft);
    } else {
      this.expensesService.addExpense(draft);
    }
    this.closeModal();
  }
}
