import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Select, type SelectOption } from '../../../../shared/ui/select/select';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PERSONS,
  type Expense,
  type ExpenseCategory,
  type ExpenseDraft,
  type ExpensePerson,
} from '../../data/expense.model';

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
  expense = input<Expense | null>(null);
  save = output<ExpenseDraft>();
  cancel = output<void>();

  protected readonly isEditMode = computed(() => this.expense() !== null);
  protected readonly modalTitle = computed(() => (this.isEditMode() ? 'Editar Gasto' : 'Nuevo Gasto'));
  protected readonly submitLabel = computed(() => (this.isEditMode() ? 'Guardar cambios' : 'Agregar gasto'));

  protected readonly date = signal(todayIso());
  protected readonly person = signal<ExpensePerson>('Benny');
  protected readonly category = signal<ExpenseCategory>('Alimentación');
  protected readonly description = signal('');
  protected readonly amount = signal('');

  protected readonly personOptions: readonly SelectOption<ExpensePerson>[] = EXPENSE_PERSONS.map(
    (person) => ({
      value: person,
      label: person,
    }),
  );

  protected readonly categoryOptions: readonly SelectOption<ExpenseCategory>[] = EXPENSE_CATEGORIES.map(
    (cat) => ({
      value: cat,
      label: cat,
    }),
  );

  constructor() {
    effect(() => {
      const existing = this.expense();
      this.date.set(existing?.date ?? todayIso());
      this.person.set(existing?.person ?? 'Benny');
      this.category.set(existing?.category ?? 'Alimentación');
      this.description.set(existing?.description ?? '');
      this.amount.set(existing ? String(existing.amount) : '');
    });
  }

  protected onAmountInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.amount.set(raw.replace(/[^0-9]/g, ''));
  }

  protected onSubmit(): void {
    const description = this.description().trim().slice(0, 100);
    const amount = Number(this.amount());

    if (!description || !this.amount() || amount <= 0) {
      return;
    }

    this.save.emit({
      date: this.date(),
      person: this.person(),
      category: this.category(),
      description,
      amount,
    });
  }
}
