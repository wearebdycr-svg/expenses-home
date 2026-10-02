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
    service.setYear(2026);
    service.setMonth(3);
    fixture.detectChanges();
  });

  it('shows the empty-state message when there are no incomes', () => {
    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState?.textContent).toContain('No hay ingresos registrados para el período seleccionado.');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('filters table rows by month when the service month filter changes', () => {
    service.addIncome({
      date: '2026-03-01',
      person: 'Benny',
      source: 'Salario',
      description: 'Salario marzo',
      amount: 3_500_000,
    });
    service.addIncome({
      date: '2026-10-01',
      person: 'Charlie',
      source: 'Salario',
      description: 'Salario octubre',
      amount: 4_000_000,
    });
    service.setMonth(10);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Salario octubre');
    expect(rows[0].textContent).not.toContain('Salario marzo');
  });

  it('renders rows with the record count when incomes exist', () => {
    service.addIncome({
      date: '2026-03-01',
      person: 'Benny',
      source: 'Salario',
      description: 'Salario marzo',
      amount: 3_500_000,
    });
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(fixture.nativeElement.querySelector('.table-count').textContent).toContain('1 registros');
  });

  it('emits edit with the clicked income', () => {
    service.addIncome({
      date: '2026-03-01',
      person: 'Benny',
      source: 'Salario',
      description: 'Salario marzo',
      amount: 3_500_000,
    });
    fixture.detectChanges();

    const spy = vi.fn();
    component.edit.subscribe(spy);

    fixture.nativeElement.querySelector('.icon-btn--edit').click();
    expect(spy).toHaveBeenCalledWith(service.filteredIncomes()[0]);
  });

  it('deletes the income when the user confirms', () => {
    service.addIncome({
      date: '2026-03-01',
      person: 'Benny',
      source: 'Salario',
      description: 'Salario marzo',
      amount: 3_500_000,
    });
    fixture.detectChanges();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.nativeElement.querySelector('.icon-btn--delete').click();
    expect(service.filteredIncomes().length).toBe(0);
  });

  it('keeps the income when the user cancels the confirmation', () => {
    service.addIncome({
      date: '2026-03-01',
      person: 'Benny',
      source: 'Salario',
      description: 'Salario marzo',
      amount: 3_500_000,
    });
    fixture.detectChanges();

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fixture.nativeElement.querySelector('.icon-btn--delete').click();
    expect(service.filteredIncomes().length).toBe(1);
  });
});
