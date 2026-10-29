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

  it('should render person filter and debts count badge', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('PERSONA');
    const badge = el.querySelector('.badge-debts-count');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toMatch(/deuda(s)? registrada(s)?/);
  });
});
