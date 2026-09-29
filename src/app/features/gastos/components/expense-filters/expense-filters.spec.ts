import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExpensesService } from '../../data/expenses.service';
import { ExpenseFilters } from './expense-filters';

describe('ExpenseFilters', () => {
  let fixture: ComponentFixture<ExpenseFilters>;
  let service: ExpensesService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ExpenseFilters] }).compileComponents();
    fixture = TestBed.createComponent(ExpenseFilters);
    service = TestBed.inject(ExpensesService);
    fixture.detectChanges();
  });

  it('shows current year and current month as default', () => {
    const now = new Date();
    expect(service.year()).toBe(now.getFullYear());
    expect(service.month()).toBe(now.getMonth() + 1);
    expect(service.day()).toBe('Todos');
    expect(service.person()).toBe('Todos');
  });

  it('renders TOTAL PERÍODO and TRANSACCIONES KPIs', () => {
    const totalEl = fixture.nativeElement.querySelector('.kpi-value--total');
    const countEl = fixture.nativeElement.querySelector('.kpi-value--count');
    expect(totalEl.textContent).toContain('$');
    expect(countEl.textContent).toContain('0');
  });
});
