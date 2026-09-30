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
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';

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
  protected readonly person = signal<ExpensePerson | ''>('');
  protected readonly category = signal<string>('General');
  protected readonly description = signal('');
  protected readonly amount = signal('');
  protected readonly hasSubmitted = signal(false);

  protected readonly errors = computed(() => {
    if (!this.hasSubmitted()) return {};
    const errs: Record<string, string> = {};
    if (!this.date()) errs['date'] = 'La fecha es obligatoria';
    if (!this.person()) errs['person'] = 'Debes seleccionar la persona';
    if (!this.description().trim()) errs['description'] = 'La descripción es obligatoria';
    const numAmount = parseThousands(this.amount());
    if (!this.amount() || numAmount <= 0) errs['amount'] = 'El monto debe ser mayor a 0';
    return errs;
  });

  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

  protected readonly personOptions: readonly SelectOption<ExpensePerson | ''>[] = EXPENSE_PERSONS.map(
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
        this.amount.set(formatThousands(exp.amount));
      } else {
        this.date.set(todayIso());
        this.person.set('');
        this.category.set('General');
        this.description.set('');
        this.amount.set('');
      }
      this.hasSubmitted.set(false);
    });
  }

  protected onAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatThousands(input.value);
    input.value = formatted;
    this.amount.set(formatted);
  }

  protected onSubmit(): void {
    this.hasSubmitted.set(true);
    const desc = this.description().trim();
    const numAmount = parseThousands(this.amount());
    const person = this.person();

    if (!person || !desc || !numAmount || numAmount <= 0 || !this.date()) {
      return;
    }

    this.save.emit({
      date: this.date(),
      person: person as ExpensePerson,
      category: this.category() || 'General',
      description: desc,
      amount: numAmount,
    });
  }
}
