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
  protected readonly amount = signal<string>('500000');
  protected readonly date = signal<string>(todayIso());

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
    });
  }

  protected onAmountInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.amount.set(raw.replace(/[^0-9]/g, ''));
  }

  protected onSubmit(): void {
    const debtId = this.selectedDebtId();
    const amountVal = Number(this.amount());

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
