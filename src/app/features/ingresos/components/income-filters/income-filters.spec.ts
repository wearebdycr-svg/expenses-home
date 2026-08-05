import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IncomesService } from '../../data/incomes.service';
import { IncomeFilters } from './income-filters';

describe('IncomeFilters', () => {
  let fixture: ComponentFixture<IncomeFilters>;
  let service: IncomesService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [IncomeFilters] }).compileComponents();
    fixture = TestBed.createComponent(IncomeFilters);
    service = TestBed.inject(IncomesService);
    fixture.detectChanges();
  });

  function selectEl(index: number): HTMLSelectElement {
    return fixture.nativeElement.querySelectorAll('select')[index] as HTMLSelectElement;
  }

  it('shows 2026 and "Todos" as the default filter values', () => {
    expect(service.year()).toBe(2026);
    expect(service.month()).toBe('Todos');
    expect(service.day()).toBe('Todos');
    expect(service.person()).toBe('Todos');
  });

  it('updates the service when the year select changes', () => {
    const yearSelect = selectEl(0);
    yearSelect.value = '0';
    yearSelect.dispatchEvent(new Event('change'));

    expect(service.year()).toBe(2025);
  });

  it('updates the service when the person select changes', () => {
    const personSelect = selectEl(3);
    personSelect.value = '1';
    personSelect.dispatchEvent(new Event('change'));

    expect(service.person()).toBe('Ana');
  });

  it('renders totals for Ana, Carlos and Total', () => {
    const totalValues = fixture.nativeElement.querySelectorAll('.total-value');
    expect(totalValues.length).toBe(3);
  });
});
