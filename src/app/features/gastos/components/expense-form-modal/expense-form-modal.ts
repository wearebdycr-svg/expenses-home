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
    // 1. Categorías oficiales estándar
    const standard: SelectOption<ExpenseCategory>[] = EXPENSE_CATEGORIES.map((cat) => ({
      value: cat,
      label: cat,
    }));

    // 2. Categorías dinámicas provenientes de deudas activas
    const activeDebts = this.debtsService.activeDebts();
    const debtOptions: SelectOption<ExpenseCategory>[] = activeDebts.map((d: Debt) => ({
      value: d.name,
      label: `Deuda: ${d.name}`,
    }));

    // Preservar la categoría actual si se está editando y pertenece a una deuda saldada
    const currentCat = this.category();
    const allOptions = [...standard, ...debtOptions];
    if (currentCat && !allOptions.some((o) => o.value === currentCat)) {
      debtOptions.push({
        value: currentCat,
        label: `Deuda: ${currentCat} (Inactiva)`,
      });
    }

    return [...standard, ...debtOptions];
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

  protected onSubmit(): void {
    this.hasSubmitted.set(true);
    const description = this.description().trim().slice(0, 100);
    const amount = parseThousands(this.amount());
    const person = this.person();

    if (!person || !description || !this.amount() || amount <= 0 || !this.date() || !this.category()) {
      return;
    }

    this.save.emit({
      date: this.date(),
      person: person as ExpensePerson,
      category: this.category(),
      description,
      amount,
    });
  }
}
