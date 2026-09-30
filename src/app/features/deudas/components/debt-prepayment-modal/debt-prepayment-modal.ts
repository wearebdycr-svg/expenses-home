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
  formatCOP,
  type Debt,
  type PrepaymentDraft,
} from '../../data/debt.model';
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-debt-prepayment-modal',
  standalone: true,
  imports: [CommonModule, Modal, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './debt-prepayment-modal.html',
  styleUrl: './debt-prepayment-modal.css',
})
export class DebtPrepaymentModal {
  debts = input<readonly Debt[]>([]);
  initialDebtId = input<string | null>(null);

  save = output<PrepaymentDraft>();
  cancel = output<void>();

  protected readonly selectedDebtId = signal<string>('');
  protected readonly amount = signal<string>('500.000');
  protected readonly date = signal<string>(todayIso());
  protected readonly hasSubmitted = signal(false);

  protected readonly errors = computed(() => {
    if (!this.hasSubmitted()) return {};
    const errs: Record<string, string> = {};
    if (!this.selectedDebtId()) errs['debtId'] = 'Debes seleccionar una deuda';
    const amountVal = parseThousands(this.amount());
    if (!this.amount() || amountVal <= 0) errs['amount'] = 'El monto del abono debe ser mayor a 0';
    if (!this.date()) errs['date'] = 'La fecha del pago es obligatoria';
    return errs;
  });

  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

  protected readonly selectedDebt = computed(() => {
    const id = this.selectedDebtId();
    return this.debts().find((d) => d.id === id) ?? null;
  });

  protected readonly currentBalanceFormatted = computed(() => {
    const debt = this.selectedDebt();
    return debt ? formatCOP(debt.currentBalance) : '$ 0';
  });

  protected readonly debtOptions = computed<SelectOption<string>[]>(() =>
    this.debts().map((d) => ({
      value: d.id,
      label: `${d.name} — ${d.person} · Saldo: ${formatCOP(d.currentBalance)}`,
    })),
  );

  constructor() {
    effect(() => {
      const initId = this.initialDebtId();
      const all = this.debts();
      if (initId && all.some((d) => d.id === initId)) {
        this.selectedDebtId.set(initId);
      } else if (all.length > 0 && (!this.selectedDebtId() || !all.some((d) => d.id === this.selectedDebtId()))) {
        this.selectedDebtId.set(all[0].id);
      }
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
    const debtId = this.selectedDebtId();
    const amountVal = parseThousands(this.amount());

    if (!debtId || amountVal <= 0 || !this.date()) {
      return;
    }

    this.save.emit({
      debtId,
      amount: amountVal,
      date: this.date(),
    });
  }
}
