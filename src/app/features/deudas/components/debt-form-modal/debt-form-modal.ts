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
import { calculateMonthlyPayment } from '../../data/debt.model';
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

  protected readonly person = signal<DebtPerson | ''>('');
  protected readonly startDate = signal(todayIso());
  protected readonly name = signal('');
  protected readonly originalAmount = signal('');
  protected readonly totalMonths = signal('');
  protected readonly currentBalance = signal('');
  protected readonly monthlyPayment = signal('');
  protected readonly annualInterestRate = signal('');
  protected readonly hasSubmitted = signal(false);

  protected readonly errors = computed(() => {
    if (!this.hasSubmitted()) return {};
    const errs: Record<string, string> = {};
    if (!this.person()) errs['person'] = 'Debes seleccionar la persona';
    if (!this.name().trim()) errs['name'] = 'El nombre de la deuda es obligatorio';
    if (!this.startDate()) errs['startDate'] = 'La fecha de inicio es obligatoria';
    const orig = parseThousands(this.originalAmount());
    if (!this.originalAmount() || orig <= 0) errs['originalAmount'] = 'El monto original debe ser mayor a 0';
    const months = Number(this.totalMonths());
    if (!this.totalMonths() || months <= 0) errs['totalMonths'] = 'El número de meses debe ser mayor a 0';
    const curr = this.currentBalance().trim() !== '' ? parseThousands(this.currentBalance()) : orig;
    if (curr <= 0) errs['currentBalance'] = 'El saldo actual debe ser mayor a 0';
    const pay = parseThousands(this.monthlyPayment());
    if (!this.monthlyPayment() || pay <= 0) errs['monthlyPayment'] = 'La cuota mensual debe ser mayor a 0';
    return errs;
  });

  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

  protected readonly personOptions: readonly SelectOption<DebtPerson | ''>[] = EXPENSE_PERSONS.map(
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
        this.person.set('');
        this.startDate.set(todayIso());
        this.name.set('');
        this.originalAmount.set('');
        this.totalMonths.set('');
        this.currentBalance.set('');
        this.monthlyPayment.set('');
        this.annualInterestRate.set('');
      }
      this.hasSubmitted.set(false);
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

  protected recalculateMonthlyPayment(): void {
    const amount = parseThousands(this.originalAmount());
    const months = Number(this.totalMonths());
    if (amount > 0 && months > 0) {
      const rate = Number(this.annualInterestRate()) || 0;
      const payment = calculateMonthlyPayment(amount, months, rate);
      this.monthlyPayment.set(formatThousands(payment));
    }
  }

  protected onSubmit(): void {
    this.hasSubmitted.set(true);
    const name = this.name().trim();
    const person = this.person();
    const original = parseThousands(this.originalAmount());
    const months = Number(this.totalMonths());
    const current = this.currentBalance().trim() !== '' ? parseThousands(this.currentBalance()) : original;
    const payment = parseThousands(this.monthlyPayment());
    const rate = Number(this.annualInterestRate()) || 0;

    if (!person || !name || original <= 0 || !months || months <= 0 || current <= 0 || payment <= 0 || isNaN(rate) || !this.startDate()) {
      return;
    }

    this.save.emit({
      name,
      person: person as DebtPerson,
      startDate: this.startDate(),
      originalAmount: original,
      currentBalance: current,
      monthlyPayment: payment,
      annualInterestRate: rate,
      totalMonths: months,
    });
  }
}
