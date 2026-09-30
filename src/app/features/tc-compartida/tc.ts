import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../../shared/ui/icon/icon';
import { TcFormModal } from './components/tc-form-modal/tc-form-modal';
import { TcKpis } from './components/tc-kpis/tc-kpis';
import { TcPaymentsList } from './components/tc-payments-list/tc-payments-list';
import { TcTable } from './components/tc-table/tc-table';
import type { TcExpense, TcExpenseDraft } from './data/tc.model';
import { TcService } from './data/tc.service';

export type TcViewTab = 'consumptions' | 'payments';

@Component({
  selector: 'app-tc-page',
  standalone: true,
  imports: [
    CommonModule,
    Icon,
    TcKpis,
    TcTable,
    TcPaymentsList,
    TcFormModal,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tc.html',
  styleUrl: './tc.css',
})
export class TcPage {
  protected readonly tcService = inject(TcService);

  protected readonly activeTab = signal<TcViewTab>('consumptions');
  protected readonly isModalOpen = signal<boolean>(false);
  protected readonly editingExpense = signal<TcExpense | null>(null);

  protected setActiveTab(tab: TcViewTab): void {
    this.activeTab.set(tab);
  }

  protected openCreateModal(): void {
    this.editingExpense.set(null);
    this.isModalOpen.set(true);
  }

  protected openEditModal(expense: TcExpense): void {
    this.editingExpense.set(expense);
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected onSave(draft: TcExpenseDraft): void {
    const editing = this.editingExpense();
    if (editing) {
      this.tcService.updateTcExpense(editing.id, draft);
    } else {
      this.tcService.addTcExpense(draft);
    }
    this.closeModal();
  }

  protected onDelete(expense: TcExpense): void {
    this.tcService.deleteTcExpense(expense.id);
  }
}
