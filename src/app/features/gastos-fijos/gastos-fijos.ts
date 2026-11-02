import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../../shared/ui/icon/icon';
import { Select, type SelectOption } from '../../shared/ui/select/select';
import { FixedExpensesService } from './data/fixed-expenses.service';
import type { FixedExpense, FixedExpenseDraft, FixedExpenseMonthlyStatus } from './data/fixed-expense.model';
import { FixedExpenseModal } from './components/fixed-expense-modal/fixed-expense-modal';
import type { ExpensePerson } from '../gastos/data/expense.model';
import { MONTHS } from '../gastos/data/expense.model';

@Component({
  selector: 'app-gastos-fijos-page',
  standalone: true,
  imports: [CommonModule, Icon, Select, FixedExpenseModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gastos-fijos.html',
  styleUrl: './gastos-fijos.css',
})
export class GastosFijosPage {
  protected readonly service = inject(FixedExpensesService);

  protected readonly isModalOpen = signal(false);
  protected readonly editingFixedExpense = signal<FixedExpense | null>(null);
  protected readonly showYearHistoryModal = signal(false);
  protected readonly historyExpense = signal<FixedExpense | null>(null);

  protected readonly monthsList = MONTHS;

  protected readonly currentMonthName = computed(() => {
    return MONTHS[this.service.selectedMonth() - 1] ?? '';
  });

  protected readonly monthOptions: readonly SelectOption<number>[] = MONTHS.map((name, index) => ({
    value: index + 1,
    label: name,
  }));

  protected readonly yearOptions: readonly SelectOption<number>[] = [
    { value: 2025, label: '2025' },
    { value: 2026, label: '2026' },
    { value: 2027, label: '2027' },
  ];

  protected readonly personOptions: readonly SelectOption<ExpensePerson | 'Todos'>[] = [
    { value: 'Todos', label: 'Todos' },
    { value: 'Compartido', label: 'Compartido' },
    { value: 'Charlie', label: 'Charlie' },
    { value: 'Benny', label: 'Benny' },
  ];

  protected openCreateModal(): void {
    this.editingFixedExpense.set(null);
    this.isModalOpen.set(true);
  }

  protected openEditModal(fixed: FixedExpense): void {
    this.editingFixedExpense.set(fixed);
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
    this.editingFixedExpense.set(null);
  }

  protected onSave(draft: FixedExpenseDraft): void {
    const current = this.editingFixedExpense();
    if (current) {
      this.service.updateFixedExpense(current.id, draft);
    } else {
      this.service.addFixedExpense(draft);
    }
    this.closeModal();
  }

  protected onDelete(fixed: FixedExpense): void {
    if (confirm(`¿Estás seguro de eliminar el gasto fijo "${fixed.name}"?`)) {
      this.service.deleteFixedExpense(fixed.id);
    }
  }

  protected openYearlyHistory(fixed: FixedExpense): void {
    this.historyExpense.set(fixed);
    this.showYearHistoryModal.set(true);
  }

  protected closeYearlyHistory(): void {
    this.showYearHistoryModal.set(false);
    this.historyExpense.set(null);
  }

  protected getYearlyHistory() {
    const fixed = this.historyExpense();
    if (!fixed) return [];
    return this.service.getYearlyHistoryForFixedExpense(fixed.id, this.service.selectedYear());
  }

  protected formatCOP(val: number): string {
    return '$' + Math.round(val).toLocaleString('es-CO');
  }
}
