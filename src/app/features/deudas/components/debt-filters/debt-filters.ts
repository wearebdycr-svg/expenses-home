import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Select, type SelectOption } from '../../../../shared/ui/select/select';
import { formatCOP, type DebtPersonFilter } from '../../data/debt.model';
import { DebtsService } from '../../data/debts.service';

@Component({
  selector: 'app-debt-filters',
  standalone: true,
  imports: [CommonModule, Select, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './debt-filters.html',
  styleUrl: './debt-filters.css',
})
export class DebtFilters {
  protected readonly debtsService = inject(DebtsService);
  protected readonly formatCOP = formatCOP;

  protected readonly personOptions: readonly SelectOption<DebtPersonFilter>[] = [
    { value: 'Todos', label: 'Todos' },
    { value: 'Benny', label: 'Benny' },
    { value: 'Charlie', label: 'Charlie' },
    { value: 'Compartido', label: 'Compartido' },
  ];

  protected readonly kpis = this.debtsService.summaryKpis;
}
