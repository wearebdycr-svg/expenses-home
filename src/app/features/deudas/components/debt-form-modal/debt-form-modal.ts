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
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';

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
  protected readonly totalMonths = signal('');
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
        this.originalAmount.set(formatThousands(existing.originalAmount));
        this.totalMonths.set(existing.totalMonths ? String(existing.totalMonths) : '');
        this.currentBalance.set(formatThousands(existing.currentBalance));
        this.monthlyPayment.set(formatThousands(existing.monthlyPayment));
        this.annualInterestRate.set(String(existing.annualInterestRate));
      } else {
        this.person.set('Benny');
        this.startDate.set(todayIso());
        this.name.set('');
        this.originalAmount.set('');
        this.totalMonths.set('');
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

  protected onOriginalAmountInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const formatted = formatThousands(raw);
    (event.target as HTMLInputElement).value = formatted;
    this.originalAmount.set(formatted);
    if (!this.isEditMode()) {
      this.currentBalance.set(formatted);
    }
    this.recalculateMonthlyPayment();
  }

  protected onCurrentBalanceInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const formatted = formatThousands(raw);
    (event.target as HTMLInputElement).value = formatted;
    this.currentBalance.set(formatted);
  }

  protected onMonthlyPaymentInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const formatted = formatThousands(raw);
    (event.target as HTMLInputElement).value = formatted;
    this.monthlyPayment.set(formatted);
  }

  protected onMonthsInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
    this.totalMonths.set(raw);
    this.recalculateMonthlyPayment();
  }

  protected onRateInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.annualInterestRate.set(raw.replace(/[^0-9.]/g, ''));
    this.recalculateMonthlyPayment();
  }

  private recalculateMonthlyPayment(): void {
    const amount = parseThousands(this.originalAmount());
    const months = Number(this.totalMonths());
    if (amount > 0 && months > 0) {
      const rate = Number(this.annualInterestRate()) || 0;
      if (rate > 0) {
        const r = rate / (12 * 100);
        const factor = Math.pow(1 + r, months);
        const payment = Math.round((amount * (r * factor)) / (factor - 1));
        this.monthlyPayment.set(formatThousands(payment));
      } else {
        this.monthlyPayment.set(formatThousands(Math.round(amount / months)));
      }
    }
  }

  protected onSubmit(): void {
    const name = this.name().trim();
    const original = parseThousands(this.originalAmount());
    const months = Number(this.totalMonths()) || undefined;
    const current = this.currentBalance().trim() !== '' ? parseThousands(this.currentBalance()) : original;
    const payment = parseThousands(this.monthlyPayment()) || (months ? Math.round(original / months) : 0);
    const rate = Number(this.annualInterestRate()) || 0;

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
      totalMonths: months,
    });
  }
}
