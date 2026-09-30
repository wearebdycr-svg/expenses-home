import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TcKpis } from './tc-kpis';
import { TcService } from '../../data/tc.service';
import { ExpensesService } from '../../../gastos/data/expenses.service';

describe('TcKpis', () => {
  let fixture: ComponentFixture<TcKpis>;
  let component: TcKpis;
  let tcService: TcService;
  let expensesService: ExpensesService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TcKpis],
    }).compileComponents();

    fixture = TestBed.createComponent(TcKpis);
    component = fixture.componentInstance;
    tcService = TestBed.inject(TcService);
    expensesService = TestBed.inject(ExpensesService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders initial empty KPI values', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.consumptions-card')).toBeTruthy();
    expect(el.querySelector('.payments-card')).toBeTruthy();
    expect(el.querySelector('.debt-card')).toBeTruthy();
    expect(el.querySelector('.people-breakdown-card')).toBeTruthy();
  });

  it('displays real-time reconciled pending debt correctly', () => {
    tcService.addTcExpense({
      date: '2026-07-01',
      person: 'Benny',
      description: 'Supermercado',
      amount: 400_000,
    });

    expensesService.addExpense({
      date: '2026-07-02',
      person: 'Charlie',
      category: 'TC-compartida',
      description: 'Abono TC',
      amount: 150_000,
    });

    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const debtValue = el.querySelector('.debt-card .kpi-value')?.textContent;
    expect(debtValue).toContain('250.000');
  });
});
