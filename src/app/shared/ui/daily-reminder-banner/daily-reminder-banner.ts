import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
} from '@angular/core';
import { DailyReminderService } from '../../../core/services/daily-reminder.service';
import { ExpensesService } from '../../../features/gastos/data/expenses.service';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-daily-reminder-banner',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daily-reminder-banner.html',
  styleUrl: './daily-reminder-banner.css',
})
export class DailyReminderBanner {
  protected readonly reminderService = inject(DailyReminderService);
  protected readonly expensesService = inject(ExpensesService);

  readonly registerExpenseClicked = output<void>();

  protected readonly show = this.reminderService.showBanner;
  protected readonly message = this.reminderService.reminderMessage;
  protected readonly icon = this.reminderService.reminderIcon;

  protected onRegisterClick(): void {
    this.expensesService.requestOpenCreateModal();
    this.registerExpenseClicked.emit();
  }

  protected onNoExpensesClick(): void {
    this.reminderService.dismissForToday();
  }
}
