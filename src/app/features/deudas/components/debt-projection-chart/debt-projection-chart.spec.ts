import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebtProjectionChart } from './debt-projection-chart';
import { DebtsService } from '../../data/debts.service';

describe('DebtProjectionChart', () => {
  let component: DebtProjectionChart;
  let fixture: ComponentFixture<DebtProjectionChart>;
  let debtsService: DebtsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DebtProjectionChart],
    }).compileComponents();

    debtsService = TestBed.inject(DebtsService);
    fixture = TestBed.createComponent(DebtProjectionChart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the projection chart component', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when there are no debts', () => {
    debtsService.debts.set([]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
  });
});
