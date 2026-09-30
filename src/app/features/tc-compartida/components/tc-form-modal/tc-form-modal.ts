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
import type { ExpensePerson } from '../../data/tc.model';
import { EXPENSE_PERSONS, TC_DEFAULT_CATEGORIES, type TcExpense, type TcExpenseDraft } from '../../data/tc.model';

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-tc-form-modal',
  standalone: true,
  imports: [Modal, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tc-form-modal.html',
  styleUrl: './tc-form-modal.css',
})
export class TcFormModal {
  tcExpense = input<TcExpense | null>(null);
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
  protected readonly person = signal<ExpensePerson>('Benny');
  protected readonly category = signal<string>('General');
  protected readonly description = signal('');
  protected readonly amount = signal('');

  protected readonly personOptions: readonly SelectOption<ExpensePerson>[] = EXPENSE_PERSONS.map(
    (person) => ({
      value: person,
      label: person,
    }),
  );

  protected readonly categoryOptions: readonly SelectOption<string>[] = TC_DEFAULT_CATEGORIES.map(
    (cat) => ({
      value: cat,
      label: cat,
    }),
  );

  constructor() {
    effect(() => {
      const exp = this.tcExpense();
      if (exp) {
        this.date.set(exp.date);
        this.person.set(exp.person);
        this.category.set(exp.category ?? 'General');
        this.description.set(exp.description);
        this.amount.set(String(exp.amount));
      } else {
        this.date.set(todayIso());
        this.person.set('Benny');
        this.category.set('General');
        this.description.set('');
        this.amount.set('');
      }
    });
  }

  protected onAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D/g, '');
    this.amount.set(sanitized);
  }

  protected onSubmit(): void {
    const desc = this.description().trim();
    const numAmount = Number(this.amount());

    if (!desc || !numAmount || numAmount <= 0) {
      return;
    }

    this.save.emit({
      date: this.date(),
      person: this.person(),
      category: this.category() || 'General',
      description: desc,
      amount: numAmount,
    });
  }
}
