import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TcPage } from './tc';
import { TcService } from './data/tc.service';
import { ExpensesService } from '../gastos/data/expenses.service';

describe('TcPage', () => {
  let fixture: ComponentFixture<TcPage>;
  let component: TcPage;
  let tcService: TcService;
  let expensesService: ExpensesService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TcPage],
    }).compileComponents();

    fixture = TestBed.createComponent(TcPage);
    component = fixture.componentInstance;
    tcService = TestBed.inject(TcService);
    expensesService = TestBed.inject(ExpensesService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('creates the component with default tab set to consumptions', () => {
    expect(component).toBeTruthy();
    expect((component as any).activeTab()).toBe('consumptions');
    expect((component as any).isModalOpen()).toBe(false);
  });

  it('switches tabs between consumptions and payments', () => {
    (component as any).setActiveTab('payments');
    expect((component as any).activeTab()).toBe('payments');

    (component as any).setActiveTab('consumptions');
    expect((component as any).activeTab()).toBe('consumptions');
  });

  it('opens create modal with null editingExpense and closes it', () => {
    (component as any).openCreateModal();
    expect((component as any).isModalOpen()).toBe(true);
    expect((component as any).editingExpense()).toBeNull();

    (component as any).closeModal();
    expect((component as any).isModalOpen()).toBe(false);
  });

  it('opens edit modal with specific expense', () => {
    const mockExpense = {
      id: 'tc-123',
      date: '2026-07-20',
      person: 'Benny' as const,
      description: 'Supermercado',
      amount: 150_000,
    };

    (component as any).openEditModal(mockExpense);
    expect((component as any).isModalOpen()).toBe(true);
    expect((component as any).editingExpense()).toEqual(mockExpense);
  });

  it('calls addTcExpense when saving in create mode', () => {
    const addSpy = vi.spyOn(tcService, 'addTcExpense');

    (component as any).openCreateModal();
    (component as any).onSave({
      date: '2026-07-15',
      person: 'Charlie',
      category: 'Entretenimiento/salidas',
      description: 'Cena',
      amount: 80_000,
    });

    expect(addSpy).toHaveBeenCalledWith({
      date: '2026-07-15',
      person: 'Charlie',
      category: 'Entretenimiento/salidas',
      description: 'Cena',
      amount: 80_000,
      cardId: 'tc-compartida',
    });
    expect((component as any).isModalOpen()).toBe(false);
  });

  it('calls deleteTcExpense when deleting', () => {
    const deleteSpy = vi.spyOn(tcService, 'deleteTcExpense');
    const mockExpense = {
      id: 'tc-999',
      date: '2026-07-15',
      person: 'Charlie' as const,
      description: 'Gasto',
      amount: 50_000,
    };

    (component as any).onDelete(mockExpense);
    expect(deleteSpy).toHaveBeenCalledWith('tc-999');
  });

  it('navigates into card detail view and goes back to cards grid', () => {
    expect(tcService.selectedCard()).toBeNull();
    const defaultCard = tcService.cards()[0];

    (component as any).selectCard(defaultCard);
    expect(tcService.selectedCard()).toEqual(defaultCard);

    (component as any).goBackToCards();
    expect(tcService.selectedCard()).toBeNull();
  });
});
