import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { IncomesService } from '../../data/incomes.service';
import { IncomeTable } from './income-table';

describe('IncomeTable', () => {
  let fixture: ComponentFixture<IncomeTable>;
  let component: IncomeTable;
  let service: IncomesService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [IncomeTable] }).compileComponents();
    fixture = TestBed.createComponent(IncomeTable);
    component = fixture.componentInstance;
    service = TestBed.inject(IncomesService);
    fixture.detectChanges();
  });

  it('renders the seeded 2026 rows with the record count', () => {
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(28);
    expect(fixture.nativeElement.querySelector('.table-count').textContent).toContain('28 registros');
  });

  it('shows the empty-state message when no income matches the filters', () => {
    service.setYear(2027);
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState?.textContent).toContain('No hay ingresos registrados para el período seleccionado.');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('emits edit with the clicked income', () => {
    const spy = vi.fn();
    component.edit.subscribe(spy);

    fixture.nativeElement.querySelector('.icon-btn--edit').click();

    expect(spy).toHaveBeenCalledWith(service.filteredIncomes()[0]);
  });

  it('deletes the income when the user confirms', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const before = service.filteredIncomes().length;

    fixture.nativeElement.querySelector('.icon-btn--delete').click();

    expect(service.filteredIncomes().length).toBe(before - 1);
  });

  it('keeps the income when the user cancels the confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const before = service.filteredIncomes().length;

    fixture.nativeElement.querySelector('.icon-btn--delete').click();

    expect(service.filteredIncomes().length).toBe(before);
  });
});
