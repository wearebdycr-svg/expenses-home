import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../../../../shared/ui/icon/icon';
import { TcService } from '../../data/tc.service';
import { formatCOP } from '../../data/tc.model';

@Component({
  selector: 'app-tc-kpis',
  standalone: true,
  imports: [CommonModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tc-kpis.html',
  styleUrl: './tc-kpis.css',
})
export class TcKpis {
  protected readonly tcService = inject(TcService);

  protected formatCOP(amount: number): string {
    return formatCOP(amount);
  }
}
