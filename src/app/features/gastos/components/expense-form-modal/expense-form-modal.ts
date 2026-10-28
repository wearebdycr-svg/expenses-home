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
  protected readonly trmService = inject(TrmService);

  expense = input<Expense | null>(null);
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

    // Preservar la categoría actual SOLO si se está editando un gasto existente previamente guardado
    const currentCat = this.category();
    const allOptions = [...standard, ...cardOptions, ...debtOptions, ...projectOptions];
    if (this.isEditMode() && currentCat && !allOptions.some((o) => o.value === currentCat)) {
      debtOptions.push({
        value: currentCat,
        label: `${currentCat}`,
      });
    }

    return [...standard, ...cardOptions, ...debtOptions, ...projectOptions];
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


  protected readonly isOverdraft = computed(() => {
    const debt = this.selectedDebt();
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
      this.category.set(existing?.category ?? 'Mercado');
      this.description.set(existing?.description ?? '');
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

    const tc = this.selectedTcCard();

    // Caso 1: Persona Compartido
    // Todo gasto asignado a 'Compartido' es un consumo de la TC Compartida sin importar la categoría
    // (Mercado, Hogar, Servicios públicos, etc.). Se registra directamente en tc_expenses y NO en Gastos Diarios.
    if (person === 'Compartido') {
      const tcCardId = tc?.id || 'tc-compartida';
      const cat = this.category();
      const expenseCategory = (cat === 'TC-compartida' || cat.startsWith('TC:')) ? 'General' : cat;

      this.tcService.addTcExpense({
        date: this.date(),
        person: 'Compartido',
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

    if (!tc || this.isEditMode()) {
      this.emitSave();
      return;
    }

    // Caso 2: Tarjeta Compartida con persona Benny o Charlie (Abono/Pago a la TC)
    if (tc.person === 'Compartido') {
      // Seleccionó Benny o Charlie: es un abono/pago a la TC Compartida desde cuenta bancaria.
      // Realiza el registro normal en Gastos Diarios y amortiza/resta la deuda de la TC.
      this.emitSave();
      return;
    }

    // Caso 3: Tarjeta Personal (no compartida, ej. Charlie o Benny)
    this.confirmationType.set('personal-tc-prompt');
  }

  protected emitSave(): void {
    const description = this.description().trim().slice(0, 100);
    const person = this.person();
    const tc = this.selectedTcCard();
    const category = tc
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
    const tc = this.selectedTcCard();
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

