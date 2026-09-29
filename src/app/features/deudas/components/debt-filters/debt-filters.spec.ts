import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebtFilters } from './debt-filters';
import { DebtsService } from '../../data/debts.service';

describe('DebtFilters', () => {
  let component: DebtFilters;
  let fixture: ComponentFixture<DebtFilters>;
  let debtsService: DebtsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DebtFilters],
    }).compileComponents();

    debtsService = TestBed.inject(DebtsService);
    fixture = TestBed.createComponent(DebtFilters);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render indicators: DEUDA TOTAL, CUOTAS/MES, % PAGADO', () => {
    const el = fixture.nativeElement as HTMLElement;
    const labels = el.querySelectorAll('.kpi-label');
    expect(labels[0].textContent).toContain('DEUDA TOTAL');
    expect(labels[1].textContent).toContain('CUOTAS/MES');
    expect(labels[2].textContent).toContain('% PAGADO');
  });
});
