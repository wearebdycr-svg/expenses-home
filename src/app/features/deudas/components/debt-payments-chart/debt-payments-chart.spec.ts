import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebtPaymentsChart } from './debt-payments-chart';
import { DebtsService } from '../../data/debts.service';

describe('DebtPaymentsChart', () => {
  let component: DebtPaymentsChart;
  let fixture: ComponentFixture<DebtPaymentsChart>;
  let debtsService: DebtsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DebtPaymentsChart],
    }).compileComponents();

    debtsService = TestBed.inject(DebtsService);
    fixture = TestBed.createComponent(DebtPaymentsChart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the payments chart component', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when there are no debts', () => {
    debtsService.debts.set([]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
  });
});
