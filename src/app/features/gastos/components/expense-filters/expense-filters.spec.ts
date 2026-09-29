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

  it('shows 2026 as the default year and Julio (7) as default month', () => {
    expect(service.year()).toBe(2026);
    expect(service.month()).toBe(7);
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
