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
import {
  EXPENSE_PERSONS,
  type ExpensePerson,
} from '../../../gastos/data/expense.model';
import type { Debt, DebtDraft, DebtPerson } from '../../data/debt.model';

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-debt-form-modal',
  standalone: true,
  imports: [CommonModule, Modal, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './debt-form-modal.html',
  styleUrl: './debt-form-modal.css',
})
export class DebtFormModal {
  debt = input<Debt | null>(null);
  save = output<DebtDraft>();
  cancel = output<void>();

  protected readonly isEditMode = computed(() => this.debt() !== null);
  protected readonly modalTitle = computed(() => (this.isEditMode() ? 'Editar Deuda' : 'Nueva Deuda'));
  protected readonly submitLabel = computed(() => (this.isEditMode() ? 'Guardar cambios' : 'Agregar deuda'));

  protected readonly person = signal<DebtPerson>('Benny');
  protected readonly startDate = signal(todayIso());
  protected readonly name = signal('');
  protected readonly originalAmount = signal('');
  protected readonly currentBalance = signal('');
  protected readonly monthlyPayment = signal('');
  protected readonly annualInterestRate = signal('');

  protected readonly personOptions: readonly SelectOption<ExpensePerson>[] = EXPENSE_PERSONS.map(
    (p) => ({ value: p, label: p }),
  );

  constructor() {
    effect(() => {
      const existing = this.debt();
      if (existing) {
        this.person.set(existing.person);
        this.startDate.set(existing.startDate || todayIso());
        this.name.set(existing.name);
        this.originalAmount.set(String(existing.originalAmount));
        this.currentBalance.set(String(existing.currentBalance));
        this.monthlyPayment.set(String(existing.monthlyPayment));
        this.annualInterestRate.set(String(existing.annualInterestRate));
      } else {
        this.person.set('Benny');
        this.startDate.set(todayIso());
        this.name.set('');
        this.originalAmount.set('');
        this.currentBalance.set('');
        this.monthlyPayment.set('');
        this.annualInterestRate.set('');
      }
    });
  }

  protected onNumberInput(signalRef: ReturnType<typeof signal<string>>, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    signalRef.set(raw.replace(/[^0-9]/g, ''));
  }

  protected onRateInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    // Allow numbers and decimal point
    this.annualInterestRate.set(raw.replace(/[^0-9.]/g, ''));
  }

  protected onSubmit(): void {
    const name = this.name().trim();
    const original = Number(this.originalAmount());
    const current = Number(this.currentBalance());
    const payment = Number(this.monthlyPayment());
    const rate = Number(this.annualInterestRate());

    if (!name || original <= 0 || current <= 0 || payment <= 0 || isNaN(rate)) {
      return;
    }

    this.save.emit({
      name,
      person: this.person(),
      startDate: this.startDate(),
      originalAmount: original,
      currentBalance: current,
      monthlyPayment: payment,
      annualInterestRate: rate,
    });
  }
}
