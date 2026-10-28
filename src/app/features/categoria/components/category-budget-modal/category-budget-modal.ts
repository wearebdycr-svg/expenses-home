import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Select, type SelectOption } from '../../../../shared/ui/select/select';
import { Icon } from '../../../../shared/ui/icon/icon';
import { ToastService } from '../../../../core/services/toast.service';
import { RemoteConfigService } from '../../../../core/services/remote-config.service';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '../../../gastos/data/expense.model';
import { formatCOP, getCategoryColor } from '../../data/categoria.model';
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';

export interface BudgetConfigItem {
  category: string;
  amount: number;
  color: string;
}

@Component({
  selector: 'app-category-budget-modal',
  standalone: true,
  imports: [CommonModule, Modal, Select, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-budget-modal.html',
  styleUrl: './category-budget-modal.css',
})
export class CategoryBudgetModal {
  private readonly remoteConfig = inject(RemoteConfigService);
  private readonly toastService = inject(ToastService);

  initialCategory = input<string | null>(null);
  close = output<void>();

  protected readonly selectedCategory = signal<string>('Mercado');
  protected readonly amount = signal<string>('');
  protected readonly hasSubmitted = signal<boolean>(false);
  protected readonly isSaving = signal<boolean>(false);

  protected readonly categoryOptions = computed<readonly SelectOption<string>[]>(() => {
    return EXPENSE_CATEGORIES.map((cat) => ({
      value: cat,
      label: cat,
    }));
  });

  protected readonly currentBudgetsList = computed<BudgetConfigItem[]>(() => {
    const map = this.remoteConfig.budgetsByCategory();
    const items: BudgetConfigItem[] = [];
    for (const [cat, amt] of Object.entries(map)) {
      if (amt > 0) {
        items.push({
          category: cat,
          amount: amt,
          color: getCategoryColor(cat),
        });
      }
    }
    return items.sort((a, b) => a.category.localeCompare(b.category));
  });

  protected readonly hasCurrentBudget = computed<boolean>(() => {
    const cat = this.selectedCategory();
    const current = this.remoteConfig.getBudgetForCategory(cat);
    return current !== null && current > 0;
  });

  protected readonly currentBudgetValue = computed<number | null>(() => {
    return this.remoteConfig.getBudgetForCategory(this.selectedCategory());
  });

  constructor() {
    effect(() => {
      const initCat = this.initialCategory();
      const targetCat = initCat || 'Mercado';
      this.selectedCategory.set(targetCat);
      this.syncAmountForCategory(targetCat);
    });
  }

  protected onCategoryChange(cat: string): void {
    this.selectedCategory.set(cat);
    this.syncAmountForCategory(cat);
  }

  private syncAmountForCategory(cat: string): void {
    const current = this.remoteConfig.getBudgetForCategory(cat);
    if (current && current > 0) {
      this.amount.set(formatThousands(current));
    } else {
      this.amount.set('');
    }
    this.hasSubmitted.set(false);
  }

  protected onAmountInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const formatted = formatThousands(raw);
    (event.target as HTMLInputElement).value = formatted;
    this.amount.set(formatted);
  }

  protected async onSave(): Promise<void> {
    this.hasSubmitted.set(true);
    const cat = this.selectedCategory();
    const parsedAmount = parseThousands(this.amount());

    if (parsedAmount <= 0) {
      return;
    }

    this.isSaving.set(true);
    try {
      await this.remoteConfig.setCategoryBudget(cat, parsedAmount);
      this.toastService.success(`Tope de ${cat} actualizado a ${formatCOP(parsedAmount)}`);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async onRemove(): Promise<void> {
    const cat = this.selectedCategory();
    this.isSaving.set(true);
    try {
      await this.remoteConfig.setCategoryBudget(cat, null);
      this.amount.set('');
      this.toastService.success(`Tope de ${cat} eliminado (sin tope)`);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected selectExistingBudget(item: BudgetConfigItem): void {
    this.selectedCategory.set(item.category);
    this.amount.set(formatThousands(item.amount));
    this.hasSubmitted.set(false);
  }

  protected formatCOP(amount: number): string {
    return formatCOP(amount);
  }
}
