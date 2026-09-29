import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Icon } from '../../../../shared/ui/icon/icon';
import {
  EXPENSE_PERSON_COLORS,
} from '../../../gastos/data/expense.model';
import {
  calculateAmortization,
  formatCOP,
  type Debt,
} from '../../data/debt.model';
import { DebtsService } from '../../data/debts.service';

@Component({
  selector: 'app-debt-table',
  standalone: true,
  imports: [CommonModule, Badge, Icon, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './debt-table.html',
  styleUrl: './debt-table.css',
})
export class DebtTable {
  private readonly debtsService = inject(DebtsService);

  readonly debts = this.debtsService.filteredDebts;
  readonly personColors = EXPENSE_PERSON_COLORS;
  readonly formatCOP = formatCOP;

  edit = output<Debt>();
  delete = output<Debt>();

  protected getAmortization(debt: Debt) {
    return calculateAmortization(debt);
  }

  protected getRateColorClass(rate: number): string {
    if (rate <= 10.0) return 'rate-low';
    if (rate <= 18.0) return 'rate-mid';
    return 'rate-high';
  }

  protected onEdit(debt: Debt): void {
    this.edit.emit(debt);
  }

  protected onDelete(debt: Debt): void {
    const confirmed = window.confirm(`¿Estás seguro de eliminar el crédito "${debt.name}"?`);
    if (confirmed) {
      this.delete.emit(debt);
    }
  }
}
