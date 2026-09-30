import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DailyReminderBanner } from './daily-reminder-banner';
import { DailyReminderService } from '../../../core/services/daily-reminder.service';
import { ExpensesService } from '../../../features/gastos/data/expenses.service';

describe('DailyReminderBanner', () => {
  let component: DailyReminderBanner;
  let fixture: ComponentFixture<DailyReminderBanner>;
  let reminderService: DailyReminderService;
  let expensesService: ExpensesService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailyReminderBanner],
    }).compileComponents();

    fixture = TestBed.createComponent(DailyReminderBanner);
    component = fixture.componentInstance;
    reminderService = TestBed.inject(DailyReminderService);
    expensesService = TestBed.inject(ExpensesService);
    fixture.detectChanges();
  });

  it('renders reminder banner when show is true', () => {
    reminderService.showBanner.set(true);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.reminder-banner-card');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('¿Tuviste gastos hoy?');
  });

  it('triggers register expense action on button click', () => {
    reminderService.showBanner.set(true);
    fixture.detectChanges();

    const emitSpy = vi.fn();
    component.registerExpenseClicked.subscribe(emitSpy);

    const reqSpy = vi.spyOn(expensesService, 'requestOpenCreateModal');

    const regBtn = fixture.nativeElement.querySelector('.btn-action-register');
    regBtn.click();

    expect(reqSpy).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('dismisses for today when clicking "Hoy no gasté nada"', () => {
    reminderService.showBanner.set(true);
    fixture.detectChanges();

    const dismissSpy = vi.spyOn(reminderService, 'dismissForToday');

    const dismissBtn = fixture.nativeElement.querySelector('.btn-action-dismiss');
    dismissBtn.click();

    expect(dismissSpy).toHaveBeenCalled();
  });
});
