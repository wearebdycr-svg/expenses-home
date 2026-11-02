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
import type { ExpensePerson } from '../../data/tc.model';
import { EXPENSE_PERSONS, TC_DEFAULT_CATEGORIES, formatCOP, type TcExpense, type TcExpenseDraft } from '../../data/tc.model';
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';
import { ProjectsService } from '../../../proyectos/data/projects.service';
import { FixedExpensesService } from '../../../gastos-fijos/data/fixed-expenses.service';
import { TcService } from '../../data/tc.service';
import { TrmService } from '../../../../core/services/trm.service';
import type { TcCard } from '../../data/tc-card.model';

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-tc-form-modal',
  standalone: true,
  imports: [CommonModule, Modal, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tc-form-modal.html',
  styleUrl: './tc-form-modal.css',
})
export class TcFormModal {
  private readonly projectsService = inject(ProjectsService);
  private readonly fixedExpensesService = inject(FixedExpensesService);
  protected readonly tcService = inject(TcService);
  protected readonly trmService = inject(TrmService);

  tcExpense = input<TcExpense | null>(null);
  defaultCardId = input<string | null>(null);
  save = output<TcExpenseDraft>();
  cancel = output<void>();

  protected readonly isEditMode = computed(() => this.tcExpense() !== null);
  protected readonly modalTitle = computed(() =>
    this.isEditMode() ? 'Editar Consumo TC' : 'Registrar Consumo con Tarjeta',
  );
  protected readonly submitLabel = computed(() =>
    this.isEditMode() ? 'Guardar cambios' : 'Registrar consumo',
  );

  protected readonly date = signal(todayIso());
  protected readonly person = signal<ExpensePerson | ''>('');
  protected readonly selectedCardId = signal<string>('tc-compartida');

  // Categorías agrupadas
  protected readonly mainCategory = signal<string>('Gastos Habituales');
  protected readonly subCategory = signal<string>('General');
  protected readonly category = signal<string>('General');

  protected readonly description = signal('');
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

  protected readonly errors = computed(() => {
    if (!this.hasSubmitted()) return {};
    const errs: Record<string, string> = {};
    if (!this.date()) errs['date'] = 'La fecha es obligatoria';
    if (!this.person()) errs['person'] = 'Debes seleccionar la persona';
    if (!this.description().trim()) errs['description'] = 'La descripción es obligatoria';

    if (this.currency() === 'COP') {
      const numAmount = parseThousands(this.amount());
      if (!this.amount() || numAmount <= 0) errs['amount'] = 'El monto debe ser mayor a 0';
    } else {
      if (this.amountUsdNumber() <= 0) {
        errs['amountUsd'] = 'Ingresa un valor en USD mayor a 0';
      }
      if (this.effectiveTrm() <= 0) {
        errs['exchangeRate'] = 'Ingresa una TRM válida';
      }
    }
    return errs;
  });

  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

  protected readonly personOptions: readonly SelectOption<ExpensePerson | ''>[] = EXPENSE_PERSONS.map(
    (person) => ({
      value: person,
      label: person,
    }),
  );

  /**
   * Opciones de Tarjeta de Crédito de cargo
   */
  protected readonly cardOptions = computed<readonly SelectOption<string>[]>(() => {
    return this.tcService.activeCards().map((c) => ({
      value: c.id,
      label: `${c.name} (•••• ${c.lastDigits} - ${c.person})`,
    }));
  });

  protected readonly targetCard = computed<TcCard | null>(() => {
    const id = this.selectedCardId();
    const active = this.tcService.activeCards();
    return active.find((c) => c.id === id) ?? this.tcService.cards().find((c) => c.id === id) ?? active[0] ?? null;
  });

  protected readonly cardMetrics = computed(() => {
    const card = this.targetCard();
    return card ? this.tcService.getCardMetrics(card.id) : null;
  });

  /**
   * Opciones de Categorías Principales Agrupadas
   */
  protected readonly mainCategoryOptions = computed<readonly SelectOption<string>[]>(() => {
    const groups: SelectOption<string>[] = [
      { value: 'Gastos Habituales', label: '🛒 Gastos Habituales (Mercado, Restaurantes, etc.)' },
      { value: 'Gastos Fijos', label: '📌 Gastos Fijos Mensuales (Ver lista...)' },
    ];

    if (this.projectsService.activeProjectCategories().length > 0) {
      groups.push({ value: 'Proyectos', label: '🎯 Proyectos & Eventos (Ver lista...)' });
    }

    return groups;
  });

  /**
   * Opciones dinámicas de subcategorías
   */
  protected readonly subCategoryOptions = computed<readonly SelectOption<string>[]>(() => {
    const main = this.mainCategory();

    if (main === 'Gastos Habituales') {
      const options: SelectOption<string>[] = TC_DEFAULT_CATEGORIES.map((cat) => ({
        value: cat,
        label: cat,
      }));
      const cur = this.category();
      if (this.isEditMode() && cur && !TC_DEFAULT_CATEGORIES.includes(cur)) {
        options.push({ value: cur, label: cur });
      }
      return options;
    }

    if (main === 'Gastos Fijos') {
      const activeFixed = this.fixedExpensesService.activeFixedExpenses();
      if (activeFixed.length === 0) {
        return [{ value: 'Gastos Fijos', label: 'Sin gastos fijos registrados' }];
      }
      return activeFixed.map((f) => ({
        value: f.name,
        label: `${f.name} (${f.person} - Est: ${formatCOP(f.expectedAmount)})`,
      }));
    }

    if (main === 'Proyectos') {
      const activeProjects = this.projectsService.activeProjectCategories();
      return activeProjects.map((p) => ({
        value: p.name,
        label: `🎯 ${p.name} (${p.person})`,
      }));
    }

    return [];
  });

  /**
   * Para retrocompatibilidad y tests
   */
  protected readonly categoryOptions = computed<readonly SelectOption<string>[]>(() => {
    const standard: SelectOption<string>[] = TC_DEFAULT_CATEGORIES.map((cat) => ({
      value: cat,
      label: cat,
    }));
    const activeProjects = this.projectsService.activeProjectCategories();
    const projectOptions: SelectOption<string>[] = activeProjects.map((p) => ({
      value: p.name,
      label: `🎯 ${p.name} (Evento)`,
    }));
    const all = [...standard, ...projectOptions];
    const currentCat = this.category();
    if (currentCat && !all.some((o) => o.value === currentCat)) {
      all.push({
        value: currentCat,
        label: `${currentCat} (Finalizado)`,
      });
    }
    return all;
  });

  protected readonly targetProject = computed(() => {
    const cat = this.category();
    return this.projectsService.projects().find((p) => p.name === cat) ?? null;
  });

  protected readonly projectMetrics = computed(() => {
    const proj = this.targetProject();
    return proj ? this.projectsService.getProjectMetrics(proj.id) : null;
  });

  protected readonly targetFixedExpense = computed(() => {
    const cat = this.category();
    return this.fixedExpensesService.fixedExpenses().find((f) => f.name === cat) ?? null;
  });

  protected readonly formatCOP = formatCOP;

  constructor() {
    effect(() => {
      const exp = this.tcExpense();
      const defCard = this.defaultCardId();
      if (exp) {
        this.date.set(exp.date);
        this.person.set(exp.person);
        this.description.set(exp.description);

        const cardToSet = exp.cardId || defCard || 'tc-compartida';
        this.selectedCardId.set(cardToSet);

        const cat = exp.category ?? 'General';
        this.category.set(cat);

        // Detectar categoría principal correspondiente
        const isProject = this.projectsService.projects().some((p) => p.name === cat);
        const isFixed = this.fixedExpensesService.fixedExpenses().some((f) => f.name === cat);

        if (isProject) {
          this.mainCategory.set('Proyectos');
          this.subCategory.set(cat);
        } else if (isFixed) {
          this.mainCategory.set('Gastos Fijos');
          this.subCategory.set(cat);
        } else {
          this.mainCategory.set('Gastos Habituales');
          this.subCategory.set(cat);
        }

        if (exp.currency === 'USD' || (exp.amountUsd && exp.amountUsd > 0)) {
          this.currency.set('USD');
          this.amountUsd.set(exp.amountUsd?.toString() || '');
          this.customTrm.set(exp.exchangeRate != null ? exp.exchangeRate.toString() : null);
          this.amount.set(formatThousands(exp.amount));
        } else {
          this.currency.set('COP');
          this.amount.set(formatThousands(exp.amount));
          this.amountUsd.set('');
          this.customTrm.set(null);
        }
      } else {
        this.date.set(todayIso());
        this.person.set('');
        this.selectedCardId.set(defCard || this.tcService.selectedCard()?.id || 'tc-compartida');
        this.mainCategory.set('Gastos Habituales');
        this.subCategory.set('General');
        this.category.set('General');
        this.description.set('');
        this.currency.set('COP');
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
    if (val === 'Gastos Habituales') {
      const def = 'General';
      this.subCategory.set(def);
      this.category.set(def);
    } else if (val === 'Gastos Fijos') {
      const first = this.fixedExpensesService.activeFixedExpenses()[0];
      const def = first ? first.name : 'Gastos Fijos';
      this.subCategory.set(def);
      this.category.set(def);
    } else if (val === 'Proyectos') {
      const first = this.projectsService.activeProjectCategories()[0];
      const def = first ? first.name : 'Proyectos';
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

  protected onSubmit(): void {
    this.hasSubmitted.set(true);
    if (this.hasErrors()) return;

    const desc = this.description().trim();
    const person = this.person();
    if (!person || !desc) return;

    const isUsd = this.currency() === 'USD';
    const finalCopAmount = isUsd
      ? this.calculatedCopAmount()
      : parseThousands(this.amount());

    const finalCardId = this.selectedCardId() || 'tc-compartida';

    this.save.emit({
      date: this.date(),
      person: person as ExpensePerson,
      category: this.category() || 'General',
      description: desc,
      amount: finalCopAmount,
      cardId: finalCardId,
      currency: isUsd ? 'USD' : 'COP',
      amountUsd: isUsd ? this.amountUsdNumber() : undefined,
      exchangeRate: isUsd ? this.effectiveTrm() : undefined,
    });
  }
}
