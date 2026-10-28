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
import { EXPENSE_CATEGORIES } from '../../../gastos/data/expense.model';
import { formatCOP, getCategoryColor } from '../../data/categoria.model';
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';

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

  protected readonly isCategoryFixed = computed<boolean>(() => Boolean(this.initialCategory()));
  protected readonly selectedCategory = signal<string>('Mercado');
  protected readonly currentCategory = computed<string>(() => this.initialCategory() || this.selectedCategory());
  protected readonly categoryColor = computed<string>(() => getCategoryColor(this.currentCategory()));
  protected readonly modalTitle = computed<string>(() =>
    this.isCategoryFixed() ? `Tope: ${this.currentCategory()}` : 'Configurar Tope Mensual',
  );

  protected readonly amount = signal<string>('');
  protected readonly hasSubmitted = signal<boolean>(false);
  protected readonly isSaving = signal<boolean>(false);

  protected readonly categoryOptions = computed<readonly SelectOption<string>[]>(() => {
    return EXPENSE_CATEGORIES.map((cat) => ({
      value: cat,
      label: cat,
    }));
  });

  protected readonly hasCurrentBudget = computed<boolean>(() => {
    const current = this.remoteConfig.getBudgetForCategory(this.currentCategory());
    return current !== null && current > 0;
  });

  constructor() {
    effect(() => {
      const initCat = this.initialCategory();
      const targetCat = initCat || this.selectedCategory();
      const current = this.remoteConfig.getBudgetForCategory(targetCat);
      if (current && current > 0) {
        this.amount.set(formatThousands(current));
      } else {
        this.amount.set('');
      }
      this.hasSubmitted.set(false);
    });
  }

  protected onCategoryChange(cat: string): void {
    this.selectedCategory.set(cat);
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
    const cat = this.currentCategory();
    const parsedAmount = parseThousands(this.amount());

    if (parsedAmount <= 0) {
      return;
    }

    this.isSaving.set(true);
    try {
      await this.remoteConfig.setCategoryBudget(cat, parsedAmount);
      this.toastService.success(`Tope de ${cat} actualizado a ${formatCOP(parsedAmount)}`);
      this.close.emit();
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async onRemove(): Promise<void> {
    const cat = this.currentCategory();
    this.isSaving.set(true);
    try {
      await this.remoteConfig.setCategoryBudget(cat, null);
      this.toastService.success(`Tope de ${cat} eliminado (sin tope)`);
      this.close.emit();
    } finally {
      this.isSaving.set(false);
    }
  }

  protected formatCOP(amount: number): string {
    return formatCOP(amount);
  }
}
