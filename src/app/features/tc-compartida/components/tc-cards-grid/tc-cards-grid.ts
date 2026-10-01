import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { TcCard, TcCardMetrics } from '../../data/tc-card.model';
import { TcService } from '../../data/tc.service';
import { formatCOP } from '../../data/tc.model';

@Component({
  selector: 'app-tc-cards-grid',
  standalone: true,
  imports: [CommonModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tc-cards-grid.html',
  styleUrl: './tc-cards-grid.css',
})
export class TcCardsGrid {
  protected readonly tcService = inject(TcService);

  createCard = output<void>();
  editCard = output<TcCard>();
  selectCard = output<TcCard>();

  protected formatCOP(amount: number): string {
    return formatCOP(amount);
  }

  protected getCardMetrics(cardId: string): TcCardMetrics {
    return this.tcService.getCardMetrics(cardId);
  }

  protected onSelect(card: TcCard): void {
    this.tcService.selectCard(card);
    this.selectCard.emit(card);
  }

  protected onEdit(event: Event, card: TcCard): void {
    event.stopPropagation();
    this.editCard.emit(card);
  }

  protected onDelete(event: Event, card: TcCard): void {
    event.stopPropagation();
    if (confirm(`¿Estás seguro de que deseas eliminar la tarjeta "${card.name}"? Los consumos previos seguirán en la base de datos.`)) {
      this.tcService.deleteCard(card.id);
    }
  }
}
