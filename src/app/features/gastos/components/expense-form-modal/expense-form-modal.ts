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
  protected readonly amount = signal('');
  protected readonly hasSubmitted = signal(false);

  protected readonly errors = computed(() => {
    if (!this.hasSubmitted()) return {};
    const errs: Record<string, string> = {};
    if (!this.date()) errs['date'] = 'La fecha es obligatoria';
    if (!this.person()) errs['person'] = 'Debes seleccionar la persona';
    if (!this.category()) errs['category'] = 'Debes seleccionar una categoría';
    if (!this.description().trim()) errs['description'] = 'La descripción es obligatoria';
    const amountVal = parseThousands(this.amount());
    if (!this.amount() || amountVal <= 0) errs['amount'] = 'El monto debe ser mayor a 0';
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

    // 2. Categorías dinámicas de Tarjetas de Crédito (TCs)
    const cardOptions: SelectOption<ExpenseCategory>[] = this.tcService.cards().map((c) => ({
      value: c.id === 'tc-compartida' ? 'TC-compartida' : `TC: ${c.name}`,
      label: `Tarjeta: ${c.name} (•••• ${c.lastDigits})`,
    }));

    // 3. Categorías dinámicas provenientes de deudas activas
    const activeDebts = this.debtsService.activeDebts();
    const debtOptions: SelectOption<ExpenseCategory>[] = activeDebts.map((d: Debt) => ({
      value: d.name,
      label: `Deuda: ${d.name}`,
    }));

    // Preservar la categoría actual si se está editando y pertenece a una deuda saldada
    const currentCat = this.category();
    const allOptions = [...standard, ...cardOptions, ...debtOptions];
    if (currentCat && !allOptions.some((o) => o.value === currentCat)) {
      debtOptions.push({
        value: currentCat,
        label: `Deuda: ${currentCat} (Inactiva)`,
      });
    }

    return [...standard, ...cardOptions, ...debtOptions];
  });

  protected readonly selectedTcCard = computed<TcCard | null>(() => {
    const cat = this.category();
    if (!cat) return null;
    return (
      this.tcService.cards().find((c) =>
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
    const entered = parseThousands(this.amount());
    return entered > debt.currentBalance;
  });

  constructor() {
    effect(() => {
      const existing = this.expense();
      this.date.set(existing?.date ?? todayIso());
      this.person.set(existing?.person ?? '');
      this.category.set(existing?.category ?? 'Mercado');
      this.description.set(existing?.description ?? '');
      this.amount.set(existing ? formatThousands(existing.amount) : '');
      this.hasSubmitted.set(false);
    });
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
    const description = this.description().trim().slice(0, 100);
    const amount = parseThousands(this.amount());
    const person = this.person();

    if (!person || !description || !this.amount() || amount <= 0 || !this.date() || !this.category()) {
      return;
    }

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
        amount,
        cardId: tcCardId,
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
    const amount = parseThousands(this.amount());
    const person = this.person();
    const tc = this.selectedTcCard();
    const category = tc
      ? (tc.id === 'tc-compartida' ? 'TC-compartida' : `TC: ${tc.name}`)
      : this.category();

    this.save.emit({
      date: this.date(),
      person: person as ExpensePerson,
      category,
      description,
      amount,
    });
  }

  protected confirmPersonalTcMovement(type: 'expense' | 'payment'): void {
    const tc = this.selectedTcCard();
    if (!tc) return;

    if (type === 'expense') {
      // Registrar como consumo directo dentro de esa TC personal
      const cat = this.category();
      const expenseCategory = cat.startsWith('TC:') ? 'General' : cat;
      this.tcService.addTcExpense({
        date: this.date(),
        person: (this.person() as ExpensePerson) || tc.person,
        category: expenseCategory || 'General',
        description: this.description().trim().slice(0, 100),
        amount: parseThousands(this.amount()),
        cardId: tc.id,
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

