import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Icon } from '../../../../shared/ui/icon/icon';
import {
  PERSON_COLORS,
  SOURCE_COLORS,
  formatCOP,
  formatDisplayDate,
  type Income,
} from '../../data/income.model';
import { IncomesService } from '../../data/incomes.service';

@Component({
  selector: 'app-income-table',
  imports: [Badge, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './income-table.html',
  styleUrl: './income-table.css',
})
export class IncomeTable {
  private readonly incomesService = inject(IncomesService);

  edit = output<Income>();

  protected readonly incomes = this.incomesService.filteredIncomes;
  protected readonly personColors = PERSON_COLORS;
  protected readonly sourceColors = SOURCE_COLORS;
  protected readonly formatCOP = formatCOP;
  protected readonly formatDisplayDate = formatDisplayDate;

  protected onEdit(income: Income): void {
    this.edit.emit(income);
  }

  protected onDelete(income: Income): void {
    const confirmed = window.confirm(`¿Eliminar el ingreso "${income.description}"?`);
    if (confirmed) {
      this.incomesService.deleteIncome(income.id);
    }
  }
}
