import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebtTable } from './debt-table';
import { DebtsService } from '../../data/debts.service';

describe('DebtTable', () => {
  let component: DebtTable;
  let fixture: ComponentFixture<DebtTable>;
  let debtsService: DebtsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DebtTable],
    }).compileComponents();

    debtsService = TestBed.inject(DebtsService);
    fixture = TestBed.createComponent(DebtTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the table component', () => {
    expect(component).toBeTruthy();
  });

  it('should render table rows when debts exist', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.debt-row').length).toBeGreaterThan(0);
  });

  it('should render empty state when there are no debts', () => {
    debtsService.debts.set([]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
  });
});
