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
import type { ExpensePerson } from '../../../gastos/data/expense.model';
import { EXPENSE_PERSONS } from '../../../gastos/data/expense.model';
import type { Project, ProjectExpense, ProjectExpenseDraft } from '../../data/project.model';
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';
import { formatCOP } from '../../../gastos/data/expense.model';
import { TrmService } from '../../../../core/services/trm.service';
import { TcService } from '../../../tc-compartida/data/tc.service';
import { ProjectsService } from '../../data/projects.service';
import { FixedExpensesService } from '../../../gastos-fijos/data/fixed-expenses.service';
import { ToastService } from '../../../../core/services/toast.service';
import type { TcCard } from '../../../tc-compartida/data/tc-card.model';
import { TC_DEFAULT_CATEGORIES } from '../../../tc-compartida/data/tc.model';

export const PROJECT_EXPENSE_CATEGORIES = [
  'General',
  'Alimentación',
  'Hospedaje',
  'Transporte & Gasolina',
  'Actividades & Entradas',
  'Compras & Souvenirs',
  'Bebidas & Licores',
  'Imprevistos',
] as const;

@Component({
  selector: 'app-project-expense-modal',
  standalone: true,
  imports: [CommonModule, Modal, Select, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-expense-modal.html',
  styleUrl: './project-expense-modal.css',
})
export class ProjectExpenseModal {
  protected readonly trmService = inject(TrmService);
  protected readonly tcService = inject(TcService);
  protected readonly projectsService = inject(ProjectsService);
  protected readonly fixedExpensesService = inject(FixedExpensesService);
  protected readonly toastService = inject(ToastService);

  project = input.required<Project>();
  expense = input<ProjectExpense | null>(null);
  save = output<ProjectExpenseDraft>();
  cancel = output<void>();

  protected readonly isEditMode = computed(() => this.expense() !== null);
  protected readonly modalTitle = computed(() =>
    this.isEditMode() ? 'Editar Gasto del Evento' : 'Registrar Gasto en ' + this.project().name,
  );

  // Form signals
  protected readonly date = signal(new Date().toISOString().split('T')[0]);
  protected readonly description = signal('');
  protected readonly person = signal<ExpensePerson>('Compartido');

  // Forma de Pago / Descuento (¿De dónde es?)
  protected readonly paymentDestination = signal<'cuenta' | 'tc'>('cuenta');
  protected readonly selectedTcCardId = signal<string>('tc-compartida');

  // Categorías Agrupadas
  protected readonly mainCategory = signal<string>('Gastos del Evento');
  protected readonly subCategory = signal<string>('General');
  protected readonly category = signal('General');

  protected readonly currency = signal<'COP' | 'USD'>('COP');
  protected readonly amount = signal('');
  protected readonly amountUsd = signal('');
  protected readonly customTrm = signal<string | null>(null);
  protected readonly hasSubmitted = signal(false);

  protected readonly effectiveTrm = computed<number>(() => {
    const custom = this.customTrm();
    if (custom !== null && custom.trim() !== '') {
      const parsed = parseFloat(custom);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return this.trmService.trm();
  });

  protected readonly displayTrm = computed<string>(() => {
    const custom = this.customTrm();
    if (custom !== null) {
      return custom;
    }
    return this.effectiveTrm().toString();
  });

  protected readonly amountUsdNumber = computed(() => {
    const val = parseFloat(this.amountUsd());
    return isNaN(val) ? 0 : val;
  });

  protected readonly calculatedCopAmount = computed(() => {
    return Math.round(this.amountUsdNumber() * this.effectiveTrm());
  });

  protected readonly personOptions: readonly SelectOption<ExpensePerson>[] = EXPENSE_PERSONS.map(
    (p) => ({
      value: p,
      label: p,
    }),
  );

  /**
   * Opciones para selector de Forma de Pago / Origen
   */
  protected readonly paymentDestinationOptions: readonly SelectOption<'cuenta' | 'tc'>[] = [
    { value: 'cuenta', label: '💵 Cuenta / Débito / Efectivo (Normal)' },
    { value: 'tc', label: '💳 Tarjeta de Crédito (Descontar cupo TC)' },
  ];

  /**
   * Tarjetas de Crédito activas para descuento
   */
  protected readonly tcCardOptions = computed<readonly SelectOption<string>[]>(() => {
    return this.tcService.activeCards().map((c) => ({
      value: c.id,
      label: `${c.name} (•••• ${c.lastDigits} - ${c.person})`,
    }));
  });

  protected readonly targetTcCard = computed<TcCard | null>(() => {
    const id = this.selectedTcCardId();
    const active = this.tcService.activeCards();
    return active.find((c) => c.id === id) ?? this.tcService.cards().find((c) => c.id === id) ?? active[0] ?? null;
  });

  protected readonly tcCardMetrics = computed(() => {
    const card = this.targetTcCard();
    return card ? this.tcService.getCardMetrics(card.id) : null;
  });

  /**
   * Opciones de Categorías Principales Agrupadas
   */
  protected readonly mainCategoryOptions = computed<readonly SelectOption<string>[]>(() => {
    const groups: SelectOption<string>[] = [
      { value: 'Gastos del Evento', label: `🎯 Gastos del Evento (${this.project().name})` },
      { value: 'Gastos Habituales', label: '🛒 Gastos Habituales (Mercado, etc.)' },
    ];
    if (this.fixedExpensesService.activeFixedExpenses().length > 0) {
      groups.push({ value: 'Gastos Fijos', label: '📌 Gastos Fijos Mensuales (Ver lista...)' });
    }
    return groups;
  });

  /**
   * Subcategorías dinámicas
   */
  protected readonly subCategoryOptions = computed<readonly SelectOption<string>[]>(() => {
    const main = this.mainCategory();
    if (main === 'Gastos del Evento') {
      return PROJECT_EXPENSE_CATEGORIES.map((c) => ({
        value: c,
        label: c,
      }));
    }
    if (main === 'Gastos Habituales') {
      return TC_DEFAULT_CATEGORIES.map((c) => ({
        value: c,
        label: c,
      }));
    }
    if (main === 'Gastos Fijos') {
      return this.fixedExpensesService.activeFixedExpenses().map((f) => ({
        value: f.name,
        label: `${f.name} (${f.person} - Est: ${formatCOP(f.expectedAmount)})`,
      }));
    }
    return [];
  });

  /**
   * Retrocompatibilidad con tests existentes
   */
  protected readonly categoryOptions: readonly SelectOption<string>[] =
    PROJECT_EXPENSE_CATEGORIES.map((c) => ({
      value: c,
      label: c,
    }));

  protected readonly formatCOP = formatCOP;

  protected readonly errors = computed(() => {
    if (!this.hasSubmitted()) return {};
    const errs: Record<string, string> = {};
    if (!this.date()) errs['date'] = 'La fecha es obligatoria';
    if (!this.description().trim()) errs['description'] = 'La descripción es obligatoria';

    if (this.currency() === 'COP') {
      const num = parseThousands(this.amount());
      if (num <= 0) errs['amount'] = 'Ingresa un valor mayor a cero';
    } else {
      if (this.amountUsdNumber() <= 0) {
        errs['amountUsd'] = 'Ingresa un valor en USD mayor a cero';
      }
      if (this.effectiveTrm() <= 0) {
        errs['exchangeRate'] = 'Ingresa una TRM válida';
      }
    }

    return errs;
  });

  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

  constructor() {
    effect(() => {
      const current = this.expense();
      if (current) {
        this.date.set(current.date);
        this.description.set(current.description);
        this.person.set(current.person);

        const cat = current.category || 'General';
        this.category.set(cat);

        // Origen del gasto
        if (current.source === 'tc' || current.id.startsWith('tc_')) {
          this.paymentDestination.set('tc');
        } else {
          this.paymentDestination.set('cuenta');
        }

        // Detectar grupo de categoría
        const isEventCat = (PROJECT_EXPENSE_CATEGORIES as readonly string[]).includes(cat);
        const isFixed = this.fixedExpensesService.fixedExpenses().some((f) => f.name === cat);
        if (isEventCat) {
          this.mainCategory.set('Gastos del Evento');
          this.subCategory.set(cat);
        } else if (isFixed) {
          this.mainCategory.set('Gastos Fijos');
          this.subCategory.set(cat);
        } else {
          this.mainCategory.set('Gastos Habituales');
          this.subCategory.set(cat);
        }

        if (current.currency === 'USD' || (current.amountUsd && current.amountUsd > 0)) {
          this.currency.set('USD');
          this.amountUsd.set(current.amountUsd?.toString() || '');
          this.customTrm.set(current.exchangeRate != null ? current.exchangeRate.toString() : null);
          this.amount.set(formatThousands(current.amount));
        } else {
          this.currency.set('COP');
          this.amount.set(formatThousands(current.amount));
          this.amountUsd.set('');
          this.customTrm.set(null);
        }
      } else {
        this.date.set(new Date().toISOString().split('T')[0]);
        this.description.set('');
        this.person.set(this.project()?.person || 'Compartido');
        this.paymentDestination.set('cuenta');
        this.selectedTcCardId.set(this.tcService.selectedCard()?.id || 'tc-compartida');
        this.mainCategory.set('Gastos del Evento');
        this.subCategory.set('General');
        this.category.set('General');
        const defaultCurrency = this.project()?.currency || 'COP';
        this.currency.set(defaultCurrency);
        this.amount.set('');
        this.amountUsd.set('');
        this.customTrm.set(null);
      }
      this.hasSubmitted.set(false);
    });
  }

  protected setCurrency(c: 'COP' | 'USD'): void {
    this.currency.set(c);
  }

  protected onMainCategoryChange(val: string): void {
    this.mainCategory.set(val);
    if (val === 'Gastos del Evento') {
      const def = 'General';
      this.subCategory.set(def);
      this.category.set(def);
    } else if (val === 'Gastos Habituales') {
      const def = 'Mercado';
      this.subCategory.set(def);
      this.category.set(def);
    } else if (val === 'Gastos Fijos') {
      const first = this.fixedExpensesService.activeFixedExpenses()[0];
      const def = first ? first.name : 'Gastos Fijos';
      this.subCategory.set(def);
      this.category.set(def);
    }
  }

  protected onSubCategoryChange(val: string): void {
    this.subCategory.set(val);
    this.category.set(val);
  }

  protected onTrmInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.customTrm.set(val);
  }

  protected onAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatThousands(input.value);
    input.value = formatted;
    this.amount.set(formatted);
  }

  protected async onSubmit(): Promise<void> {
    this.hasSubmitted.set(true);
    if (this.hasErrors()) return;

    const isUsd = this.currency() === 'USD';
    const finalCopAmount = isUsd
      ? this.calculatedCopAmount()
      : parseThousands(this.amount());

    const desc = this.description().trim();

    // Si la forma de pago es Tarjeta de Crédito (TC)
    if (this.paymentDestination() === 'tc') {
      const cardId = this.selectedTcCardId() || 'tc-compartida';
      const eventTag = `[Evento: ${this.project().name}]`;
      const fullDescription = desc.includes(eventTag) ? desc : `${eventTag} ${desc}`;

      await this.tcService.addTcExpense({
        date: this.date(),
        person: this.person(),
        category: this.project().name,
        description: fullDescription,
        amount: finalCopAmount,
        cardId,
        currency: isUsd ? 'USD' : 'COP',
        amountUsd: isUsd ? this.amountUsdNumber() : undefined,
        exchangeRate: isUsd ? this.effectiveTrm() : undefined,
      });

      // Si venía editando un gasto directo anterior, eliminarlo para no duplicar
      const currentExp = this.expense();
      if (currentExp && !currentExp.id.startsWith('tc_')) {
        await this.projectsService.deleteProjectExpense(currentExp.id);
      }

      this.toastService.show('Gasto registrado con cargo a la Tarjeta de Crédito', { type: 'success' });
      this.cancel.emit();
      return;
    }

    // Forma de pago Cuenta / Efectivo: registro directo tradicional
    this.save.emit({
      projectId: this.project().id,
      date: this.date(),
      description: desc,
      amount: finalCopAmount,
      person: this.person(),
      category: this.category(),
      currency: isUsd ? 'USD' : 'COP',
      amountUsd: isUsd ? this.amountUsdNumber() : undefined,
      exchangeRate: isUsd ? this.effectiveTrm() : undefined,
    });
  }
}
