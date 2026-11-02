import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectExpenseModal } from './project-expense-modal';
import type { Project } from '../../data/project.model';
import { TrmService } from '../../../../core/services/trm.service';

describe('ProjectExpenseModal', () => {
  let fixture: ComponentFixture<ProjectExpenseModal>;
  let component: ProjectExpenseModal;

  const mockProject: Project = {
    id: 'proj-1',
    name: 'Paseo San Juan PR',
    budgetAmount: 5_000_000,
    person: 'Compartido',
    icon: '✈️',
    color: '#3B82F6',
    status: 'activo',
    createdAt: '2026-10-27T00:00:00.000Z',
  };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ProjectExpenseModal],
      providers: [TrmService],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectExpenseModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('project', mockProject);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders modal in create mode with COP as default currency', () => {
    expect((component as any).modalTitle()).toContain('Paseo San Juan PR');
    expect((component as any).currency()).toBe('COP');
  });

  it('switches to USD mode and converts to COP with TRM', () => {
    (component as any).setCurrency('USD');
    expect((component as any).currency()).toBe('USD');

    (component as any).amountUsd.set('150');
    (component as any).customTrm.set('4000');

    expect((component as any).calculatedCopAmount()).toBe(600_000);
  });

  it('emits save with calculated COP amount and USD details', () => {
    const saveSpy = vi.spyOn(component.save, 'emit');

    (component as any).date.set('2026-10-27');
    (component as any).description.set('Hotel San Juan');
    (component as any).setCurrency('USD');
    (component as any).amountUsd.set('200');
    (component as any).customTrm.set('4100');
    (component as any).person.set('Charlie');

    (component as any).onSubmit();

    expect(saveSpy).toHaveBeenCalledWith({
      projectId: 'proj-1',
      date: '2026-10-27',
      description: 'Hotel San Juan',
      amount: 820_000,
      person: 'Charlie',
      category: 'General',
      currency: 'USD',
      amountUsd: 200,
      exchangeRate: 4100,
    });
  });

  it('updates subcategories when changing mainCategory', () => {
    (component as any).onMainCategoryChange('Gastos Habituales');
    expect((component as any).mainCategory()).toBe('Gastos Habituales');
    expect((component as any).subCategory()).toBe('Mercado');

    (component as any).onMainCategoryChange('Gastos del Evento');
    expect((component as any).mainCategory()).toBe('Gastos del Evento');
    expect((component as any).subCategory()).toBe('General');
  });

  it('routes to tcService.addTcExpense when payment destination is TC', async () => {
    const tcService = TestBed.inject((await import('../../../tc-compartida/data/tc.service')).TcService);
    const tcSpy = vi.spyOn(tcService, 'addTcExpense').mockResolvedValue({} as any);

    (component as any).paymentDestination.set('tc');
    (component as any).selectedTcCardId.set('tc-compartida');
    (component as any).description.set('Cena de bienvenida');
    (component as any).amount.set('180000');
    (component as any).person.set('Compartido');
    (component as any).date.set('2026-10-28');

    await (component as any).onSubmit();

    expect(tcSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: 'tc-compartida',
        amount: 180_000,
        category: 'Paseo San Juan PR',
        description: '[Evento: Paseo San Juan PR] Cena de bienvenida',
      }),
    );
  });
});
