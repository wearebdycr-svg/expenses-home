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
  selector: 'app-debt-cards',
  standalone: true,
  imports: [CommonModule, Badge, Icon, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './debt-cards.html',
  styleUrl: './debt-cards.css',
})
export class DebtCards {
  protected readonly debtsService = inject(DebtsService);
  protected readonly debts = this.debtsService.filteredDebts;
  protected readonly personColors = EXPENSE_PERSON_COLORS;
  protected readonly formatCOP = formatCOP;

  prepayment = output<Debt>();
  createDebt = output<void>();

  protected getAmortization(debt: Debt) {
    return calculateAmortization(debt);
  }

  protected getPercentPaid(debt: Debt): number {
    if (debt.originalAmount <= 0) return 0;
    const paid = ((debt.originalAmount - debt.currentBalance) / debt.originalAmount) * 100;
    return Math.max(0, Math.min(100, paid));
  }

  protected onPrepayment(debt: Debt): void {
    this.prepayment.emit(debt);
  }

  protected onCreate(): void {
    this.createDebt.emit();
  }
}
