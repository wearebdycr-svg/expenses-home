import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../../shared/ui/icon/icon';
import { DebtCards } from './components/debt-cards/debt-cards';
import { DebtFilters } from './components/debt-filters/debt-filters';
import { DebtFormModal } from './components/debt-form-modal/debt-form-modal';
import { DebtPaymentsChart } from './components/debt-payments-chart/debt-payments-chart';
import { DebtPrepaymentModal } from './components/debt-prepayment-modal/debt-prepayment-modal';
import { DebtProjectionChart } from './components/debt-projection-chart/debt-projection-chart';
import { DebtTable } from './components/debt-table/debt-table';
import type { Debt, DebtDraft, PrepaymentDraft } from './data/debt.model';
import { DebtsService } from './data/debts.service';

@Component({
  selector: 'app-deudas-page',
  standalone: true,
  imports: [
    CommonModule,
    Icon,
    DebtFilters,
    DebtCards,
    DebtProjectionChart,
    DebtPaymentsChart,
    DebtTable,
    DebtFormModal,
    DebtPrepaymentModal,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './deudas.html',
  styleUrl: './deudas.css',
})
export class DeudasPage {
  protected readonly debtsService = inject(DebtsService);

  protected readonly isFormModalOpen = signal(false);
  protected readonly editingDebt = signal<Debt | null>(null);
  protected readonly isPrepaymentModalOpen = signal(false);
  protected readonly initialPrepaymentDebtId = signal<string | null>(null);

  protected openCreateModal(): void {
    this.editingDebt.set(null);
    this.isFormModalOpen.set(true);
  }

  protected openEditModal(debt: Debt): void {
    this.editingDebt.set(debt);
    this.isFormModalOpen.set(true);
  }

  protected closeFormModal(): void {
    this.isFormModalOpen.set(false);
  }

  protected onSaveDebt(draft: DebtDraft): void {
    const editing = this.editingDebt();
    if (editing) {
      this.debtsService.updateDebt(editing.id, draft);
    } else {
      this.debtsService.addDebt(draft);
    }
    this.closeFormModal();
  }

  protected onDeleteDebt(debt: Debt): void {
    this.debtsService.deleteDebt(debt.id);
  }

  protected openPrepaymentModal(debtId?: string | null): void {
    this.initialPrepaymentDebtId.set(debtId ?? null);
    this.isPrepaymentModalOpen.set(true);
  }

  protected closePrepaymentModal(): void {
    this.isPrepaymentModalOpen.set(false);
  }

  protected onSavePrepayment(draft: PrepaymentDraft): void {
    this.debtsService.applyPrepayment(draft);
    this.closePrepaymentModal();
  }
}
