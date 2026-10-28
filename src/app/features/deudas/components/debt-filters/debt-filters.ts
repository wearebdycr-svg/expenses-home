import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Select, type SelectOption } from '../../../../shared/ui/select/select';
import { type DebtPersonFilter } from '../../data/debt.model';
import { DebtsService } from '../../data/debts.service';

@Component({
  selector: 'app-debt-filters',
  standalone: true,
  imports: [CommonModule, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './debt-filters.html',
  styleUrl: './debt-filters.css',
})
export class DebtFilters {
  protected readonly debtsService = inject(DebtsService);

  protected readonly personOptions: readonly SelectOption<DebtPersonFilter>[] = [
    { value: 'Todos', label: 'Todos' },
    { value: 'Benny', label: 'Benny' },
    { value: 'Charlie', label: 'Charlie' },
    { value: 'Compartido', label: 'Compartido' },
  ];
}
