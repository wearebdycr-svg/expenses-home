import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../../shared/ui/icon/icon';
import { TcCardsGrid } from './components/tc-cards-grid/tc-cards-grid';
import { TcCardModal } from './components/tc-card-modal/tc-card-modal';
import { TcFilters } from './components/tc-filters/tc-filters';
import { TcFormModal } from './components/tc-form-modal/tc-form-modal';
import { TcKpis } from './components/tc-kpis/tc-kpis';
import { TcPaymentsList } from './components/tc-payments-list/tc-payments-list';
import { TcTable } from './components/tc-table/tc-table';
import type { TcCard, TcCardDraft } from './data/tc-card.model';
import type { TcExpense, TcExpenseDraft } from './data/tc.model';
import { TcService } from './data/tc.service';

export type TcViewTab = 'consumptions' | 'payments';

@Component({
  selector: 'app-tc-page',
  standalone: true,
  imports: [
    CommonModule,
    Icon,
    TcCardsGrid,
    TcCardModal,
    TcFilters,
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

  constructor() {
    // Al entrar a la sección de TCs, siempre mostrar el panel principal con todas las tarjetas
    this.tcService.selectCard(null);
  }

  // Tabs de vista detallada (consumos vs abonos)
  protected readonly activeTab = signal<TcViewTab>('consumptions');

  // Modal de Consumo de TC
  protected readonly isExpenseModalOpen = signal<boolean>(false);
  protected readonly editingExpense = signal<TcExpense | null>(null);

  // Modal de Tarjeta de Crédito (Crear / Editar)
  protected readonly isCardModalOpen = signal<boolean>(false);
  protected readonly editingCard = signal<TcCard | null>(null);

  protected setActiveTab(tab: TcViewTab): void {
    this.activeTab.set(tab);
  }

  // --- Navegación y Selección de Tarjeta ---
  protected goBackToCards(): void {
    this.tcService.selectCard(null);
  }

  protected selectCard(card: TcCard): void {
    this.tcService.selectCard(card);
  }

  // --- Manejo de Modal de Consumos ---
  protected openCreateExpenseModal(): void {
    this.editingExpense.set(null);
    this.isExpenseModalOpen.set(true);
  }

  protected openEditExpenseModal(expense: TcExpense): void {
    this.editingExpense.set(expense);
    this.isExpenseModalOpen.set(true);
  }

  protected closeExpenseModal(): void {
    this.isExpenseModalOpen.set(false);
  }

  // Aliases para retrocompatibilidad
  protected readonly isModalOpen = this.isExpenseModalOpen;
  protected openCreateModal(): void {
    this.openCreateExpenseModal();
  }
  protected openEditModal(expense: TcExpense): void {
    this.openEditExpenseModal(expense);
  }
  protected closeModal(): void {
    this.closeExpenseModal();
  }
  protected onSave(draft: TcExpenseDraft): void {
    this.onSaveExpense(draft);
  }
  protected onDelete(expense: TcExpense): void {
    this.onDeleteExpense(expense);
  }

  protected onSaveExpense(draft: TcExpenseDraft): void {
    const currentCard = this.tcService.selectedCard();
    const cardId = currentCard?.id ?? 'tc-compartida';
    const fullDraft: TcExpenseDraft = { ...draft, cardId };

    const editing = this.editingExpense();
    if (editing) {
      this.tcService.updateTcExpense(editing.id, fullDraft);
    } else {
      this.tcService.addTcExpense(fullDraft);
    }
    this.closeExpenseModal();
  }

  protected onDeleteExpense(expense: TcExpense): void {
    this.tcService.deleteTcExpense(expense.id);
  }

  // --- Manejo de Modal de Tarjeta ---
  protected openCreateCardModal(): void {
    this.editingCard.set(null);
    this.isCardModalOpen.set(true);
  }

  protected openEditCardModal(card: TcCard | null): void {
    if (!card) return;
    this.editingCard.set(card);
    this.isCardModalOpen.set(true);
  }

  protected closeCardModal(): void {
    this.isCardModalOpen.set(false);
  }

  protected onSaveCard(draft: TcCardDraft): void {
    const editing = this.editingCard();
    if (editing) {
      this.tcService.updateCard(editing.id, draft);
    } else {
      const newCard = this.tcService.addCard(draft);
      this.tcService.selectCard(newCard);
    }
    this.closeCardModal();
  }

  protected onDeleteCard(card: TcCard): void {
    if (confirm(`¿Estás seguro de que deseas eliminar la tarjeta "${card.name}"? Los consumos previos seguirán en la base de datos.`)) {
      this.tcService.deleteCard(card.id);
    }
  }
}
