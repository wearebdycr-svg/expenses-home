import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Icon } from '../../shared/ui/icon/icon';
import { IncomeBarChart } from './components/income-bar-chart/income-bar-chart';
import { IncomeFilters } from './components/income-filters/income-filters';
import { IncomeFormModal } from './components/income-form-modal/income-form-modal';
import { IncomeTable } from './components/income-table/income-table';
import { IncomeTrendChart } from './components/income-trend-chart/income-trend-chart';
import type { Income, IncomeDraft } from './data/income.model';
import { IncomesService } from './data/incomes.service';

@Component({
  selector: 'app-ingresos-page',
  imports: [Icon, IncomeFilters, IncomeBarChart, IncomeTrendChart, IncomeTable, IncomeFormModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ingresos.html',
  styleUrl: './ingresos.css',
})
export class IngresosPage {
  private readonly incomesService = inject(IncomesService);

  protected readonly isModalOpen = signal(false);
  protected readonly editingIncome = signal<Income | null>(null);

  protected openCreateModal(): void {
    this.editingIncome.set(null);
    this.isModalOpen.set(true);
  }

  protected openEditModal(income: Income): void {
    this.editingIncome.set(income);
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected onSave(draft: IncomeDraft): void {
    const editing = this.editingIncome();
    if (editing) {
      this.incomesService.updateIncome(editing.id, draft);
    } else {
      this.incomesService.addIncome(draft);
    }
    this.closeModal();
  }
}
