import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
import type { FixedExpense, FixedExpenseDraft, FixedExpenseStatus } from '../../data/fixed-expense.model';
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';

@Component({
  selector: 'app-fixed-expense-modal',
  standalone: true,
  imports: [CommonModule, Modal, Select, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fixed-expense-modal.html',
  styleUrl: './fixed-expense-modal.css',
})
export class FixedExpenseModal {
  fixedExpense = input<FixedExpense | null>(null);
  save = output<FixedExpenseDraft>();
  cancel = output<void>();

  protected readonly isEditMode = computed(() => this.fixedExpense() !== null);
  protected readonly modalTitle = computed(() =>
    this.isEditMode() ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo Mensual',
  );

  // Form signals
  protected readonly name = signal('');
  protected readonly expectedAmount = signal('');
  protected readonly person = signal<ExpensePerson>('Compartido');
  protected readonly dueDay = signal('');
  protected readonly status = signal<FixedExpenseStatus>('activo');
  protected readonly notes = signal('');
  protected readonly hasSubmitted = signal(false);

  protected readonly personOptions: readonly SelectOption<ExpensePerson>[] = EXPENSE_PERSONS.map(
    (p) => ({
      value: p,
      label: p,
    }),
  );

  protected readonly statusOptions: readonly SelectOption<FixedExpenseStatus>[] = [
    { value: 'activo', label: '🟢 Activo' },
    { value: 'inactivo', label: '⚪ Inactivo / Pausado' },
  ];

  protected readonly errors = computed(() => {
    if (!this.hasSubmitted()) return {};
    const errs: Record<string, string> = {};
    if (!this.name().trim()) errs['name'] = 'El nombre del gasto fijo es obligatorio';
    const amount = parseThousands(this.expectedAmount());
    if (amount <= 0) errs['expectedAmount'] = 'Ingresa un valor mayor a cero';
    if (this.dueDay()) {
      const day = parseInt(this.dueDay(), 10);
      if (isNaN(day) || day < 1 || day > 31) {
        errs['dueDay'] = 'El día debe estar entre 1 y 31';
      }
    }
    return errs;
  });

  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

  constructor() {
    effect(() => {
      const current = this.fixedExpense();
      if (current) {
        this.name.set(current.name);
        this.expectedAmount.set(formatThousands(current.expectedAmount));
        this.person.set(current.person);
        this.dueDay.set(current.dueDay ? current.dueDay.toString() : '');
        this.status.set(current.status || 'activo');
        this.notes.set(current.notes || '');
      } else {
        this.name.set('');
        this.expectedAmount.set('');
        this.person.set('Compartido');
        this.dueDay.set('');
        this.status.set('activo');
        this.notes.set('');
      }
      this.hasSubmitted.set(false);
    });
  }

  protected onAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatThousands(input.value);
    input.value = formatted;
    this.expectedAmount.set(formatted);
  }

  protected onSubmit(): void {
    this.hasSubmitted.set(true);
    if (this.hasErrors()) return;

    const amount = parseThousands(this.expectedAmount());
    const day = this.dueDay() ? parseInt(this.dueDay(), 10) : undefined;

    this.save.emit({
      name: this.name().trim(),
      expectedAmount: amount,
      person: this.person(),
      dueDay: day,
      status: this.status(),
      notes: this.notes().trim() || undefined,
    });
  }
}
