import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FixedExpensesQuickModal } from './fixed-expenses-quick-modal';
import { FixedExpensesService } from '../../data/fixed-expenses.service';
import { ExpensesService } from '../../../gastos/data/expenses.service';

describe('FixedExpensesQuickModal', () => {
  let fixture: ComponentFixture<FixedExpensesQuickModal>;
  let component: FixedExpensesQuickModal;
  let fixedService: FixedExpensesService;
  let expensesService: ExpensesService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [FixedExpensesQuickModal],
    }).compileComponents();

    fixedService = TestBed.inject(FixedExpensesService);
    expensesService = TestBed.inject(ExpensesService);

    fixture = TestBed.createComponent(FixedExpensesQuickModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders correctly and shows empty state when no fixed expenses exist', () => {
    expect(fixture.nativeElement.textContent).toContain('No tienes gastos fijos');
  });

  it('emits close event when close button is clicked', () => {
    const closeSpy = vi.fn();
    component.close.subscribe(closeSpy);

    const closeBtn = fixture.nativeElement.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.click();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('emits goToFullSection event when action button is clicked', () => {
    const navSpy = vi.fn();
    component.goToFullSection.subscribe(navSpy);

    const fullBtn = fixture.nativeElement.querySelector('.btn-primary') as HTMLButtonElement;
    fullBtn.click();

    expect(navSpy).toHaveBeenCalled();
  });

  it('displays items with paid and pending badges appropriately', async () => {
    fixedService.setYear(2026);
    fixedService.setMonth(11); // Noviembre

    await fixedService.addFixedExpense({
      name: 'Internet Fibra',
      expectedAmount: 90_000,
      person: 'Compartido',
      dueDay: 10,
      status: 'activo',
    });

    await fixedService.addFixedExpense({
      name: 'Netflix',
      expectedAmount: 40_000,
      person: 'Benny',
      dueDay: 15,
      status: 'activo',
    });

    // Pay only Netflix
    await expensesService.addExpense({
      description: 'Pago mensual Netflix',
      amount: 40_000,
      person: 'Benny',
      category: 'Gastos Fijos',
      date: '2026-11-05',
    });

    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.quick-item-card');
    expect(items.length).toBe(2);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Internet Fibra');
    expect(text).toContain('Netflix');
    expect(text).toContain('Pagado');
    expect(text).toContain('Por pagar');
  });
});
