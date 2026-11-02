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
import { Modal } from '../../../../shared/ui/modal/modal';
import { Select, type SelectOption } from '../../../../shared/ui/select/select';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PERSONS,
  formatCOP,
  type Expense,
  type ExpenseCategory,
  type ExpenseDraft,
  type ExpensePerson,
} from '../../data/expense.model';
import { DebtsService } from '../../../deudas/data/debts.service';
import type { Debt } from '../../../deudas/data/debt.model';
import { TcService } from '../../../tc-compartida/data/tc.service';
import type { TcCard } from '../../../tc-compartida/data/tc-card.model';
import { ExpensesService } from '../../data/expenses.service';
import { ProjectsService } from '../../../proyectos/data/projects.service';
import type { Project } from '../../../proyectos/data/project.model';
import { FixedExpensesService } from '../../../gastos-fijos/data/fixed-expenses.service';
import type { FixedExpense } from '../../../gastos-fijos/data/fixed-expense.model';
import { TrmService } from '../../../../core/services/trm.service';
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-expense-form-modal',
  imports: [Modal, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expense-form-modal.html',
  styleUrl: './expense-form-modal.css',
})
export class ExpenseFormModal {
  private readonly debtsService = inject(DebtsService);
  protected readonly tcService = inject(TcService);
  private readonly expensesService = inject(ExpensesService);
  private readonly projectsService = inject(ProjectsService);
  private readonly fixedExpensesService = inject(FixedExpensesService);
  protected readonly trmService = inject(TrmService);

  expense = input<Expense | null>(null);
  protected readonly mainCategory = signal<string>('Gastos Habituales');
  protected readonly subCategory = signal<string>('Mercado');
  protected readonly paymentDestination = signal<'cuenta' | 'tc' | 'deuda' | 'proyecto'>('cuenta');
  protected readonly selectedTcCardId = signal<string>('');
  protected readonly selectedDebtId = signal<string>('');
  protected readonly selectedProjectId = signal<string>('');
  save = output<ExpenseDraft>();
  cancel = output<void>();

  protected readonly formatCOP = formatCOP;
  protected readonly parseThousands = parseThousands;

  protected readonly isEditMode = computed(() => this.expense() !== null);
  protected readonly modalTitle = computed(() => (this.isEditMode() ? 'Editar Gasto' : 'Nuevo Gasto'));
  protected readonly submitLabel = computed(() => (this.isEditMode() ? 'Guardar cambios' : 'Agregar gasto'));

  protected readonly date = signal(todayIso());
  protected readonly person = signal<ExpensePerson | ''>('');
  protected readonly category = signal<ExpenseCategory>('Mercado');
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
    if (!this.category()) errs['category'] = 'Debes seleccionar una categoría';
    if (!this.description().trim()) errs['description'] = 'La descripción es obligatoria';

    if (this.currency() === 'COP') {
      const amountVal = parseThousands(this.amount());
      if (!this.amount() || amountVal <= 0) errs['amount'] = 'El monto debe ser mayor a 0';
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

  protected readonly HABITUAL_CATEGORIES: readonly ExpenseCategory[] = EXPENSE_CATEGORIES.filter(
    (c) => c !== 'Deudas' && c !== 'TC-compartida',
  );

  /**
   * Opciones de Categorías Principales Agrupadas
   */
  protected readonly mainCategoryOptions = computed<readonly SelectOption<string>[]>(() => {
    const groups: SelectOption<string>[] = [
      { value: 'Gastos Habituales', label: '🛒 Gastos Habituales (Mercado, Transporte, etc.)' },
      { value: 'Gastos Fijos', label: '📌 Gastos Fijos Mensuales (Ver lista...)' },
      { value: 'Deudas', label: '💳 Deudas / Créditos (Ver lista...)' },
      { value: 'Tarjetas', label: '💳 Tarjetas de Crédito (Ver lista...)' },
    ];

    if (this.projectsService.activeProjectCategories().length > 0) {
      groups.push({ value: 'Proyectos', label: '🎯 Proyectos & Eventos (Ver lista...)' });
    }

    return groups;
  });

  /**
   * Indica si la categoría principal seleccionada requiere elegir una subcategoría
   */
  protected readonly hasSubcategories = computed<boolean>(() => {
    const main = this.mainCategory();
    return (
      main === 'Gastos Habituales' ||
      main === 'Deudas' ||
      main === 'Gastos Fijos' ||
      main === 'Tarjetas' ||
      main === 'Proyectos'
    );
  });

  /**
   * Etiqueta del selector de subcategorías
   */
  protected readonly subCategoryLabel = computed<string>(() => {
    switch (this.mainCategory()) {
      case 'Gastos Habituales':
        return 'Seleccionar Categoría Habitual';
      case 'Deudas':
        return 'Seleccionar Crédito / Deuda a Pagar';
      case 'Gastos Fijos':
        return 'Seleccionar Gasto Fijo';
      case 'Tarjetas':
        return 'Seleccionar Tarjeta de Crédito';
      case 'Proyectos':
        return 'Seleccionar Proyecto o Evento';
      default:
        return 'Subcategoría';
    }
  });

  /**
   * Opciones dinámicas de subcategorías según el grupo principal seleccionado
   */
  protected readonly subCategoryOptions = computed<readonly SelectOption<string>[]>(() => {
    const main = this.mainCategory();

    if (main === 'Gastos Habituales') {
      const options: SelectOption<string>[] = this.HABITUAL_CATEGORIES.map((cat) => ({
        value: cat,
        label: cat,
      }));
      const currentCat = this.category();
      if (this.isEditMode() && currentCat && !this.HABITUAL_CATEGORIES.includes(currentCat)) {
        options.push({ value: currentCat, label: currentCat });
      }
      return options;
    }

    if (main === 'Deudas') {
      const activeDebts = this.debtsService.activeDebts();
      if (activeDebts.length === 0) {
        return [{ value: 'Deudas', label: 'Sin créditos activos registrados (General)' }];
      }
      return activeDebts.map((d: Debt) => ({
        value: d.name,
        label: `${d.name} (${d.person} - Saldo: ${this.formatCOP(d.currentBalance)})`,
      }));
    }

    if (main === 'Gastos Fijos') {
      const activeFixed = this.fixedExpensesService.activeFixedExpenses();
      if (activeFixed.length === 0) {
        return [{ value: '', label: 'Sin gastos fijos registrados' }];
      }
      return activeFixed.map((f: FixedExpense) => ({
        value: f.name,
        label: `${f.name} (${f.person} - Est: ${this.formatCOP(f.expectedAmount)})`,
      }));
    }

    if (main === 'Tarjetas') {
      const activeCards = this.tcService.activeCards();
      return activeCards.map((c: TcCard) => ({
        value: c.id === 'tc-compartida' ? 'TC-compartida' : `TC: ${c.name}`,
        label: `${c.name} (•••• ${c.lastDigits} - ${c.person})`,
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
   * Opciones para selector de Forma de Pago / Destino
   */
  protected readonly paymentDestinationOptions = computed<readonly SelectOption<'cuenta' | 'tc' | 'deuda' | 'proyecto'>[]>(() => {
    const list: SelectOption<'cuenta' | 'tc' | 'deuda' | 'proyecto'>[] = [
      { value: 'cuenta', label: '💵 Cuenta / Débito / Efectivo (Normal)' },
      { value: 'tc', label: '💳 Tarjeta de Crédito (Descontar cupo TC)' },
      { value: 'deuda', label: '🏦 Abono a Crédito / Deuda (Amortizar)' },
    ];
    if (this.projectsService.activeProjectCategories().length > 0) {
      list.push({ value: 'proyecto', label: '🎯 Proyecto / Evento (Vincular)' });
    }
    return list;
  });

  protected readonly tcDestinationOptions = computed<readonly SelectOption<string>[]>(() => {
    return this.tcService.activeCards().map((c) => ({
      value: c.id,
      label: `${c.name} (•••• ${c.lastDigits} - ${c.person})`,
    }));
  });

  protected readonly debtDestinationOptions = computed<readonly SelectOption<string>[]>(() => {
    return this.debtsService.activeDebts().map((d) => ({
      value: d.id,
      label: `${d.name} (${d.person} - Saldo: ${this.formatCOP(d.currentBalance)})`,
    }));
  });

  protected readonly projectDestinationOptions = computed<readonly SelectOption<string>[]>(() => {
    return this.projectsService.activeProjectCategories().map((p) => ({
      value: p.id,
      label: `${p.icon} ${p.name} (${p.person})`,
    }));
  });

  protected readonly targetTcCard = computed<TcCard | null>(() => {
    const isTcDestination = this.paymentDestination() === 'tc';
    const directTc = this.selectedTcCard();
    if (!isTcDestination && !directTc) {
      return null;
    }
    if (directTc && !isTcDestination) {
      return directTc;
    }
    const id = this.selectedTcCardId();
    const active = this.tcService.activeCards();
    if (id) {
      const found = active.find((c) => c.id === id);
      if (found) return found;
    }
    return directTc;
  });

  protected readonly targetDebt = computed<Debt | null>(() => {
    const isDebtDest = this.paymentDestination() === 'deuda';
    const isDirectDebtCat = Boolean(this.selectedDebt());
    if (!isDebtDest && !isDirectDebtCat) {
      return null;
    }
    const id = this.selectedDebtId();
    const all = this.debtsService.allDebts();
    if (id) {
      const found = all.find((d) => d.id === id);
      if (found) return found;
    }
    return this.selectedDebt();
  });

  protected readonly targetProject = computed<Project | null>(() => {
    const isProjDest = this.paymentDestination() === 'proyecto';
    const cat = this.category();
    const isDirectProjCat = this.projectsService.projects().some((p) => p.name === cat);
    if (!isProjDest && !isDirectProjCat) {
      return null;
    }
    const id = this.selectedProjectId();
    const active = this.projectsService.projects();
    if (id) {
      const found = active.find((p) => p.id === id);
      if (found) return found;
    }
    return active.find((p) => p.name === cat) ?? null;
  });

  protected onPaymentDestinationChange(dest: 'cuenta' | 'tc' | 'deuda' | 'proyecto'): void {
    this.paymentDestination.set(dest);
    if (dest === 'tc') {
      const active = this.tcService.activeCards();
      if (!this.selectedTcCardId() && active.length > 0) {
        this.selectedTcCardId.set(active[0].id);
      }
    } else if (dest === 'deuda') {
      const active = this.debtsService.activeDebts();
      if (!this.selectedDebtId() && active.length > 0) {
        this.selectedDebtId.set(active[0].id);
      }
    } else if (dest === 'proyecto') {
      const active = this.projectsService.activeProjectCategories();
      if (!this.selectedProjectId() && active.length > 0) {
        this.selectedProjectId.set(active[0].id);
      }
    }
  }

  /**
   * Handler al cambiar la categoría principal
   */
  protected onMainCategoryChange(selectedMain: string): void {
    this.mainCategory.set(selectedMain);

    if (selectedMain === 'Gastos Habituales') {
      const sub = 'Mercado';
      this.subCategory.set(sub);
      this.category.set(sub as ExpenseCategory);
    } else if (selectedMain === 'Deudas') {
      const firstDebt = this.debtsService.activeDebts()[0];
      const sub = firstDebt ? firstDebt.name : 'Deudas';
      this.subCategory.set(sub);
      this.category.set(sub as ExpenseCategory);
      this.paymentDestination.set('deuda');
      if (firstDebt) this.selectedDebtId.set(firstDebt.id);
    } else if (selectedMain === 'Gastos Fijos') {
      const firstFixed = this.fixedExpensesService.activeFixedExpenses()[0];
      const sub = firstFixed ? firstFixed.name : '';
      this.subCategory.set(sub);
      this.category.set(sub as ExpenseCategory);
    } else if (selectedMain === 'Tarjetas') {
      const firstCard = this.tcService.activeCards()[0];
      const sub = firstCard ? (firstCard.id === 'tc-compartida' ? 'TC-compartida' : `TC: ${firstCard.name}`) : 'TC-compartida';
      this.subCategory.set(sub);
      this.category.set(sub as ExpenseCategory);
      this.paymentDestination.set('tc');
      if (firstCard) this.selectedTcCardId.set(firstCard.id);
    } else if (selectedMain === 'Proyectos') {
      const firstProj = this.projectsService.activeProjectCategories()[0];
      const sub = firstProj ? firstProj.name : '';
      this.subCategory.set(sub);
      this.category.set(sub as ExpenseCategory);
      this.paymentDestination.set('proyecto');
      if (firstProj) this.selectedProjectId.set(firstProj.id);
    } else {
      this.subCategory.set('');
      this.category.set(selectedMain as ExpenseCategory);
    }
  }

  /**
   * Handler al cambiar la subcategoría
   */
  protected onSubCategoryChange(selectedSub: string): void {
    this.subCategory.set(selectedSub);
    this.category.set(selectedSub as ExpenseCategory);

    const main = this.mainCategory();
    if (main === 'Deudas') {
      const debt = this.debtsService.activeDebts().find((d) => d.name === selectedSub);
      if (debt) this.selectedDebtId.set(debt.id);
    } else if (main === 'Tarjetas') {
      const card = this.tcService.activeCards().find((c) =>
        (c.id === 'tc-compartida' ? 'TC-compartida' : `TC: ${c.name}`) === selectedSub || c.name === selectedSub,
      );
      if (card) this.selectedTcCardId.set(card.id);
    } else if (main === 'Proyectos') {
      const proj = this.projectsService.activeProjectCategories().find((p) => p.name === selectedSub);
      if (proj) this.selectedProjectId.set(proj.id);
    }
  }

  protected readonly categoryOptions = computed<readonly SelectOption<ExpenseCategory>[]>(() => {
    // 1. Categorías oficiales estándar (excluyendo TC-compartida para agruparla junto con las tarjetas)
    const standard: SelectOption<ExpenseCategory>[] = EXPENSE_CATEGORIES
      .filter((cat) => cat !== 'TC-compartida')
      .map((cat) => ({
        value: cat,
        label: cat,
      }));

    // 2. Categorías dinámicas de Tarjetas de Crédito (TCs) activas (excluye canceladas)
    const cardOptions: SelectOption<ExpenseCategory>[] = this.tcService.activeCards().map((c) => ({
      value: c.id === 'tc-compartida' ? 'TC-compartida' : `TC: ${c.name}`,
      label: `Tarjeta: ${c.name} (•••• ${c.lastDigits})`,
    }));

    // 3. Categorías dinámicas provenientes de deudas activas (excluye saldadas)
    const activeDebts = this.debtsService.activeDebts();
    const debtOptions: SelectOption<ExpenseCategory>[] = activeDebts.map((d: Debt) => ({
      value: d.name,
      label: `Deuda: ${d.name}`,
    }));

    // 4. Categorías dinámicas provenientes de Proyectos & Eventos activos y vigentes
    const activeProjects = this.projectsService.activeProjectCategories();
    const projectOptions: SelectOption<ExpenseCategory>[] = activeProjects.map((p) => ({
      value: p.name as ExpenseCategory,
      label: `🎯 ${p.name} (Evento)`,
    }));

    // 5. Categorías dinámicas provenientes de Gastos Fijos Mensuales activos
    const activeFixed = this.fixedExpensesService.activeFixedExpenses();
    const fixedOptions: SelectOption<ExpenseCategory>[] = activeFixed.map((f: FixedExpense) => ({
      value: f.name as ExpenseCategory,
      label: `📌 Fijo: ${f.name}`,
    }));

    // Preservar la categoría actual SOLO si se está editando un gasto existente previamente guardado
    const currentCat = this.category();
    const allOptions = [...standard, ...cardOptions, ...debtOptions, ...projectOptions, ...fixedOptions];
    if (this.isEditMode() && currentCat && !allOptions.some((o) => o.value === currentCat)) {
      debtOptions.push({
        value: currentCat,
        label: `${currentCat}`,
      });
    }

    return [...standard, ...cardOptions, ...debtOptions, ...projectOptions, ...fixedOptions];
  });

  protected readonly selectedTcCard = computed<TcCard | null>(() => {
    const cat = this.category();
    if (!cat) return null;
    return (
      this.tcService.activeCards().find((c) =>
        cat === (c.id === 'tc-compartida' ? 'TC-compartida' : `TC: ${c.name}`) ||
        cat === c.name ||
        cat === `TC: ${c.name}`
      ) ?? null
    );
  });

  protected readonly selectedDebt = computed(() => {
    const cat = this.category();
    return this.debtsService.allDebts().find((d: Debt) => d.name === cat) ?? null;
  });

  protected readonly selectedFixedExpense = computed(() => {
    const cat = this.category();
    if (!cat) return null;
    return (
      this.fixedExpensesService.activeFixedExpenses().find(
        (f) => f.name === cat || cat === `📌 Fijo: ${f.name}` || cat === `Fijo: ${f.name}`,
      ) ?? null
    );
  });


  protected readonly isOverdraft = computed(() => {
    const debt = this.targetDebt();
    if (!debt) return false;
    const isUsd = this.currency() === 'USD';
    const entered = isUsd ? this.calculatedCopAmount() : parseThousands(this.amount());
    return entered > debt.currentBalance;
  });

  constructor() {
    effect(() => {
      const existing = this.expense();
      this.date.set(existing?.date ?? todayIso());
      this.person.set(existing?.person ?? '');
      this.description.set(existing?.description ?? '');

      const initialCat = existing?.category ?? 'Mercado';
      this.category.set(initialCat);

      // Determinar si la categoría pertenece a Deudas, Gastos Fijos, Tarjetas, Proyectos o Estándar
      const isDebt = this.debtsService.allDebts().some((d) => d.name === initialCat) || initialCat === 'Deudas';
      const isFixed = this.fixedExpensesService.activeFixedExpenses().some((f) => f.name === initialCat);
      const isCard = this.tcService.activeCards().some((c) => (c.id === 'tc-compartida' ? 'TC-compartida' : `TC: ${c.name}`) === initialCat || c.name === initialCat);
      const isProj = this.projectsService.projects().some((p) => p.name === initialCat);

      if (isDebt) {
        this.mainCategory.set('Deudas');
        this.subCategory.set(initialCat);
      } else if (isFixed) {
        this.mainCategory.set('Gastos Fijos');
        this.subCategory.set(initialCat);
      } else if (isCard) {
        this.mainCategory.set('Tarjetas');
        this.subCategory.set(initialCat);
      } else if (isProj) {
        this.mainCategory.set('Proyectos');
        this.subCategory.set(initialCat);
      } else {
        this.mainCategory.set('Gastos Habituales');
        this.subCategory.set(initialCat);
      }

      // Determinar vinculación / forma de pago
      const existingDesc = existing?.description ?? '';
      if (isCard) {
        this.paymentDestination.set('tc');
        const c = this.tcService.activeCards().find((card) => (card.id === 'tc-compartida' ? 'TC-compartida' : `TC: ${card.name}`) === initialCat || card.name === initialCat);
        if (c) this.selectedTcCardId.set(c.id);
      } else if (isDebt || existingDesc.includes('[Deuda:')) {
        this.paymentDestination.set('deuda');
        const d = this.debtsService.allDebts().find((debt) => debt.name === initialCat || existingDesc.includes(`[Deuda: ${debt.name}]`));
        if (d) this.selectedDebtId.set(d.id);
      } else if (isProj || existingDesc.includes('[Evento:')) {
        this.paymentDestination.set('proyecto');
        const p = this.projectsService.projects().find((proj) => proj.name === initialCat || existingDesc.includes(`[Evento: ${proj.name}]`));
        if (p) this.selectedProjectId.set(p.id);
      } else if (existing?.person === 'Compartido') {
        this.paymentDestination.set('tc');
        this.selectedTcCardId.set('tc-compartida');
      } else {
        this.paymentDestination.set('cuenta');
        this.selectedDebtId.set('');
        this.selectedProjectId.set('');
        const firstCard = this.tcService.activeCards()[0];
        if (firstCard) this.selectedTcCardId.set(firstCard.id);
      }

      if (existing) {
        if (existing.currency === 'USD' || (existing.amountUsd && existing.amountUsd > 0)) {
          this.currency.set('USD');
          this.amountUsd.set(existing.amountUsd?.toString() || '');
          this.customTrm.set(existing.exchangeRate != null ? existing.exchangeRate.toString() : null);
          this.amount.set(formatThousands(existing.amount));
        } else {
          this.currency.set('COP');
          this.amount.set(formatThousands(existing.amount));
          this.amountUsd.set('');
          this.customTrm.set(null);
        }
      } else {
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

  protected onTrmInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.customTrm.set(val);
  }

  protected onAmountInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const formatted = formatThousands(raw);
    (event.target as HTMLInputElement).value = formatted;
    this.amount.set(formatted);
  }

  protected readonly confirmationType = signal<'none' | 'personal-tc-prompt'>('none');

  protected onSubmit(): void {
    this.hasSubmitted.set(true);
    if (this.hasErrors()) return;

    const description = this.description().trim().slice(0, 100);
    const person = this.person();
    if (!person || !description || !this.date() || !this.category()) {
      return;
    }

    const isUsd = this.currency() === 'USD';
    const finalCopAmount = isUsd
      ? this.calculatedCopAmount()
      : parseThousands(this.amount());

    if (finalCopAmount <= 0) return;

    const dest = this.paymentDestination();
    const isDirectTc = Boolean(this.selectedTcCard());
    const isTc = dest === 'tc' || isDirectTc;

    // 1. Tarjeta de Crédito (TC) o Persona Compartido
    if (isTc || person === 'Compartido') {
      const tc = this.targetTcCard() || this.selectedTcCard() || this.tcService.activeCards().find((c) => c.id === 'tc-compartida');
      const tcCardId = tc?.id || 'tc-compartida';
      const cat = this.category();
      const expenseCategory = (cat === 'TC-compartida' || cat.startsWith('TC:')) ? 'General' : cat;

      // Si la tarjeta es TC Compartida pero la persona es Benny o Charlie (y no se seleccionó explícitamente TC como forma de pago):
      // es un ABONO (pago) a la tarjeta desde cuenta bancaria. Realiza registro normal en Gastos Diarios.
      if (dest !== 'tc' && tc && tc.person === 'Compartido' && person !== 'Compartido') {
        this.emitSave();
        return;
      }

      // Si es TC personal con Benny o Charlie, y no estamos editando:
      // preguntar si es consumo o pago
      if (person !== 'Compartido' && tc && tc.person !== 'Compartido' && !this.isEditMode()) {
        this.confirmationType.set('personal-tc-prompt');
        return;
      }

      // Registro de consumo directo en TC (descuenta cupo y aumenta deuda)
      this.tcService.addTcExpense({
        date: this.date(),
        person: (person as ExpensePerson) || tc?.person || 'Compartido',
        category: expenseCategory || 'General',
        description,
        amount: finalCopAmount,
        cardId: tcCardId,
        currency: isUsd ? 'USD' : 'COP',
        amountUsd: isUsd ? this.amountUsdNumber() : undefined,
        exchangeRate: isUsd ? this.effectiveTrm() : undefined,
      });

      if (this.isEditMode()) {
        const editing = this.expense();
        if (editing) {
          this.expensesService.deleteExpense(editing.id);
        }
      }

      this.cancel.emit();
      return;
    }

    // 2. Abono a Crédito / Deuda
    if (dest === 'deuda') {
      const debt = this.targetDebt();
      let finalDescription = description;
      let finalCategory = this.category();

      if (debt) {
        if (!finalDescription.toLowerCase().includes(debt.name.toLowerCase())) {
          finalDescription = `${finalDescription} [Deuda: ${debt.name}]`;
        }
        if (finalCategory === 'Deudas') {
          finalCategory = debt.name as ExpenseCategory;
        }
      }

      this.save.emit({
        date: this.date(),
        person: person as ExpensePerson,
        category: finalCategory,
        description: finalDescription,
        amount: finalCopAmount,
        currency: isUsd ? 'USD' : 'COP',
        amountUsd: isUsd ? this.amountUsdNumber() : undefined,
        exchangeRate: isUsd ? this.effectiveTrm() : undefined,
      });
      return;
    }

    // 3. Proyecto / Evento
    if (dest === 'proyecto') {
      const project = this.targetProject();
      let finalDescription = description;

      if (project) {
        if (!finalDescription.toLowerCase().includes(project.name.toLowerCase())) {
          finalDescription = `${finalDescription} [Evento: ${project.name}]`;
        }
      }

      this.save.emit({
        date: this.date(),
        person: person as ExpensePerson,
        category: this.category(),
        description: finalDescription,
        amount: finalCopAmount,
        currency: isUsd ? 'USD' : 'COP',
        amountUsd: isUsd ? this.amountUsdNumber() : undefined,
        exchangeRate: isUsd ? this.effectiveTrm() : undefined,
      });
      return;
    }

    // 4. Cuenta / Normal
    this.emitSave();
  }

  protected emitSave(): void {
    const description = this.description().trim().slice(0, 100);
    const person = this.person();
    const isTc = this.paymentDestination() === 'tc' || Boolean(this.selectedTcCard());
    const tc = isTc ? this.targetTcCard() : null;
    const category = isTc && tc
      ? (tc.id === 'tc-compartida' ? 'TC-compartida' : `TC: ${tc.name}`)
      : this.category();

    const isUsd = this.currency() === 'USD';
    const finalCopAmount = isUsd
      ? this.calculatedCopAmount()
      : parseThousands(this.amount());

    this.save.emit({
      date: this.date(),
      person: person as ExpensePerson,
      category,
      description,
      amount: finalCopAmount,
      currency: isUsd ? 'USD' : 'COP',
      amountUsd: isUsd ? this.amountUsdNumber() : undefined,
      exchangeRate: isUsd ? this.effectiveTrm() : undefined,
    });
  }

  protected confirmPersonalTcMovement(type: 'expense' | 'payment'): void {
    const tc = this.targetTcCard() || this.selectedTcCard();
    if (!tc) return;

    const isUsd = this.currency() === 'USD';
    const finalCopAmount = isUsd
      ? this.calculatedCopAmount()
      : parseThousands(this.amount());

    if (type === 'expense') {
      // Registrar como consumo directo dentro de esa TC personal
      const cat = this.category();
      const expenseCategory = cat.startsWith('TC:') ? 'General' : cat;
      this.tcService.addTcExpense({
        date: this.date(),
        person: (this.person() as ExpensePerson) || tc.person,
        category: expenseCategory || 'General',
        description: this.description().trim().slice(0, 100),
        amount: finalCopAmount,
        cardId: tc.id,
        currency: isUsd ? 'USD' : 'COP',
        amountUsd: isUsd ? this.amountUsdNumber() : undefined,
        exchangeRate: isUsd ? this.effectiveTrm() : undefined,
      });
      this.confirmationType.set('none');
      this.cancel.emit();
    } else {
      // Registrar como abono (pago a la tarjeta) en Gastos Diarios
      this.confirmationType.set('none');
      this.emitSave();
    }
  }

  protected cancelConfirmation(): void {
    this.confirmationType.set('none');
  }
}

