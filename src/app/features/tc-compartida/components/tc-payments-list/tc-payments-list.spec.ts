import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TcPaymentsList } from './tc-payments-list';
import { TcService } from '../../data/tc.service';
import { ExpensesService } from '../../../gastos/data/expenses.service';

describe('TcPaymentsList', () => {
  let fixture: ComponentFixture<TcPaymentsList>;
  let component: TcPaymentsList;
  let expensesService: ExpensesService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TcPaymentsList],
    }).compileComponents();

    fixture = TestBed.createComponent(TcPaymentsList);
    component = fixture.componentInstance;
    expensesService = TestBed.inject(ExpensesService);
    const tcService = TestBed.inject(TcService);
    tcService.setYear(2026);
    tcService.setMonth(7);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders empty state when there are no amortized payments', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
  });

  it('renders rows for payments registered with TC-compartida category', () => {
    expensesService.addExpense({
      date: '2026-07-22',
      person: 'Benny',
      category: 'TC-compartida',
      description: 'Abono cuota TC Bancolombia',
      amount: 320_000,
    });

    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state')).toBeFalsy();
    expect(el.querySelectorAll('.payment-row').length).toBe(1);
    expect(el.querySelector('.col-description')?.textContent).toContain('Abono cuota TC Bancolombia');
    expect(el.querySelector('.amortized-value')?.textContent).toContain('320.000');
  });
});
