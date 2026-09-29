import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeudasPage } from './deudas';
import { DebtsService, DEFAULT_DEBTS } from './data/debts.service';

describe('DeudasPage', () => {
  let component: DeudasPage;
  let fixture: ComponentFixture<DeudasPage>;
  let debtsService: DebtsService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DeudasPage],
    }).compileComponents();

    fixture = TestBed.createComponent(DeudasPage);
    component = fixture.componentInstance;
    debtsService = TestBed.inject(DebtsService);
    debtsService.debts.set(DEFAULT_DEBTS);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create the deudas page', () => {
    expect(component).toBeTruthy();
  });

  it('should render header with title, subtitle, and action buttons', () => {
    const el = fixture.nativeElement as HTMLElement;
    const title = el.querySelector('.page-title');
    const subtitle = el.querySelector('.page-subtitle');
    const prepayBtn = el.querySelector('.btn-prepayment');
    const createBtn = el.querySelector('.btn-primary');

    expect(title?.textContent).toContain('Proyección de Deudas');
    expect(subtitle?.textContent).toContain('Seguimiento y proyección de pagos');
    expect(prepayBtn?.textContent).toContain('Pago a Capital');
    expect(createBtn?.textContent).toContain('Nueva Deuda');
  });

  it('should render filters, cards, charts, and table', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-debt-filters')).toBeTruthy();
    expect(el.querySelector('app-debt-cards')).toBeTruthy();
    expect(el.querySelector('app-debt-projection-chart')).toBeTruthy();
    expect(el.querySelector('app-debt-payments-chart')).toBeTruthy();
    expect(el.querySelector('app-debt-table')).toBeTruthy();
  });

  it('opens and closes the debt form modal', async () => {
    expect(fixture.nativeElement.querySelector('app-debt-form-modal')).toBeNull();

    const createBtn = fixture.nativeElement.querySelector('.btn-primary') as HTMLButtonElement;
    createBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-debt-form-modal')).toBeTruthy();

    component['closeFormModal']();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-debt-form-modal')).toBeNull();
  });

  it('opens and closes the prepayment modal', async () => {
    expect(fixture.nativeElement.querySelector('app-debt-prepayment-modal')).toBeNull();

    const prepayBtn = fixture.nativeElement.querySelector('.btn-prepayment') as HTMLButtonElement;
    prepayBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-debt-prepayment-modal')).toBeTruthy();

    component['closePrepaymentModal']();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-debt-prepayment-modal')).toBeNull();
  });

  it('handles prepayment save correctly', () => {
    debtsService.debts.set(DEFAULT_DEBTS);
    const initialBalance = debtsService.debts()[0].currentBalance;
    component['onSavePrepayment']({
      debtId: debtsService.debts()[0].id,
      amount: 500_000,
      date: '2026-07-29',
    });

    expect(debtsService.debts()[0].currentBalance).toBe(initialBalance - 500_000);
  });
});
