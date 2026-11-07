import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../../../../shared/ui/icon/icon';
import { FixedExpensesService } from '../../data/fixed-expenses.service';
import type { ResultadoCalculoVencimiento } from '../../data/fixed-expense.model';
import { MONTHS } from '../../../gastos/data/expense.model';

@Component({
  selector: 'app-fixed-expenses-quick-modal',
  standalone: true,
  imports: [CommonModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fixed-expenses-quick-modal.html',
  styleUrl: './fixed-expenses-quick-modal.css',
})
export class FixedExpensesQuickModal {
  protected readonly service = inject(FixedExpensesService);

  close = output<void>();
  goToFullSection = output<void>();

  protected readonly currentMonthName = computed(() => {
    return MONTHS[this.service.selectedMonth() - 1] ?? '';
  });

  protected readonly summary = computed(() => this.service.summary());

  protected formatCOP(val: number): string {
    return '$' + Math.round(val).toLocaleString('es-CO');
  }

  protected getVencimientoLabel(v: ResultadoCalculoVencimiento): string {
    switch (v.estado) {
      case 'al_dia':
        return `Al día (${v.diasRestantes}d)`;
      case 'proximo':
        return `Próximo (${v.diasRestantes}d)`;
      case 'vence_hoy':
        return '¡Vence hoy!';
      case 'vencido':
        return `Vencido (${Math.abs(v.diasRestantes)}d)`;
    }
  }
}
