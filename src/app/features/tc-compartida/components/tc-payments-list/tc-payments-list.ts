import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Icon } from '../../../../shared/ui/icon/icon';
import { TcService } from '../../data/tc.service';
import { EXPENSE_PERSON_COLORS, formatCOP, formatDisplayDate } from '../../data/tc.model';

@Component({
  selector: 'app-tc-payments-list',
  standalone: true,
  imports: [CommonModule, Icon, Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tc-payments-list.html',
  styleUrl: './tc-payments-list.css',
})
export class TcPaymentsList {
  protected readonly tcService = inject(TcService);
  protected readonly personColors = EXPENSE_PERSON_COLORS;

  protected readonly targetCategoryName = computed<string>(() => {
    const card = this.tcService.selectedCard();
    if (!card || card.id === 'tc-compartida') {
      return 'TC-compartida';
    }
    return `TC: ${card.name}`;
  });

  protected formatDisplayDate(isoDate: string): string {
    return formatDisplayDate(isoDate);
  }

  protected formatCOP(amount: number): string {
    return formatCOP(amount);
  }
}

