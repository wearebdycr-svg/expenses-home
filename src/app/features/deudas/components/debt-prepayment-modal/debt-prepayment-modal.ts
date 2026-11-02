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
import { CommonModule } from '@angular/common';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Select, type SelectOption } from '../../../../shared/ui/select/select';
import {
  formatCOP,
  type Debt,
  type PrepaymentDraft,
} from '../../data/debt.model';
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';
import { TcService } from '../../../tc-compartida/data/tc.service';
import type { TcCard } from '../../../tc-compartida/data/tc-card.model';

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
  protected readonly tcService = inject(TcService);

  debts = input<readonly Debt[]>([]);
  initialDebtId = input<string | null>(null);

  save = output<PrepaymentDraft>();
  cancel = output<void>();

  protected readonly selectedDebtId = signal<string>('');
  protected readonly amount = signal<string>('500.000');
  protected readonly date = signal<string>(todayIso());
  protected readonly hasSubmitted = signal(false);

  // Forma de Pago / Origen del dinero
  protected readonly paymentDestination = signal<'cuenta' | 'tc'>('cuenta');
  protected readonly selectedTcCardId = signal<string>('tc-compartida');

  protected readonly paymentDestinationOptions: readonly SelectOption<'cuenta' | 'tc'>[] = [
    { value: 'cuenta', label: '💵 Cuenta / Débito / Efectivo (Normal)' },
    { value: 'tc', label: '💳 Tarjeta de Crédito (Avance / Cargo a TC)' },
  ];

  protected readonly tcCardOptions = computed<readonly SelectOption<string>[]>(() => {
    return this.tcService.activeCards().map((c) => ({
      value: c.id,
      label: `${c.name} (•••• ${c.lastDigits} - ${c.person})`,
    }));
  });

  protected readonly targetTcCard = computed<TcCard | null>(() => {
    const id = this.selectedTcCardId();
    const active = this.tcService.activeCards();
    return active.find((c) => c.id === id) ?? this.tcService.cards().find((c) => c.id === id) ?? active[0] ?? null;
  });

  protected readonly tcCardMetrics = computed(() => {
    const card = this.targetTcCard();
    return card ? this.tcService.getCardMetrics(card.id) : null;
  });

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

  protected readonly projectedBalanceFormatted = computed(() => {
    const debt = this.selectedDebt();
    if (!debt) return '$ 0';
    const amountVal = parseThousands(this.amount());
    const remaining = Math.max(0, debt.currentBalance - amountVal);
    return formatCOP(remaining);
  });

  protected readonly debtOptions = computed<SelectOption<string>[]>(() =>
    this.debts().map((d) => ({
      value: d.id,
      label: `${d.name} — ${d.person} · Saldo: ${formatCOP(d.currentBalance)}`,
    })),
  );

  protected readonly formatCOP = formatCOP;

  constructor() {
    effect(() => {
      const initId = this.initialDebtId();
      const all = this.debts();
      if (initId && all.some((d) => d.id === initId)) {
        this.selectedDebtId.set(initId);
      } else if (all.length > 0 && (!this.selectedDebtId() || !all.some((d) => d.id === this.selectedDebtId()))) {
        this.selectedDebtId.set(all[0].id);
      }
      this.selectedTcCardId.set(this.tcService.selectedCard()?.id || 'tc-compartida');
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
      paymentMethod: this.paymentDestination(),
      cardId: this.paymentDestination() === 'tc' ? this.selectedTcCardId() : undefined,
    });
  }
}
