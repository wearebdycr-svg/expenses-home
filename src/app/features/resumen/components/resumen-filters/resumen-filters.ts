import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Select, type SelectOption } from '../../../../shared/ui/select/select';
import {
  YEARS,
  formatCOP,
  type ResumenPerson,
} from '../../data/resumen.model';
import { ResumenService } from '../../data/resumen.service';

@Component({
  selector: 'app-resumen-filters',
  imports: [Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resumen-filters.html',
  styleUrl: './resumen-filters.css',
})
export class ResumenFilters {
  protected readonly resumenService = inject(ResumenService);
  protected readonly formatCOP = formatCOP;

  protected readonly yearOptions: readonly SelectOption<number>[] = YEARS.map((year) => ({
    value: year,
    label: String(year),
  }));

  protected readonly personOptions: readonly SelectOption<ResumenPerson>[] = [
    { value: 'Todos', label: 'Todos' },
    { value: 'Benny', label: 'Benny' },
    { value: 'Charlie', label: 'Charlie' },
    { value: 'Compartido', label: 'Compartido' },
  ];
}
