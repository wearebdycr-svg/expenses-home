import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebtCards } from './debt-cards';
import { DebtsService } from '../../data/debts.service';

describe('DebtCards', () => {
  let component: DebtCards;
  let fixture: ComponentFixture<DebtCards>;
  let debtsService: DebtsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DebtCards],
    }).compileComponents();

    debtsService = TestBed.inject(DebtsService);
    fixture = TestBed.createComponent(DebtCards);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render debt cards when debts exist', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.debt-card').length).toBeGreaterThan(0);
  });

  it('should show empty state when there are no debts', () => {
    debtsService.debts.set([]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state-card')).toBeTruthy();
  });
});
