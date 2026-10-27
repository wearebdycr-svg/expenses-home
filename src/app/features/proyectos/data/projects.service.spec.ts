import { TestBed } from '@angular/core/testing';
import { ProjectsService } from './projects.service';

describe('ProjectsService - Módulo Proyectos & Eventos', () => {
  let service: ProjectsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProjectsService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts with empty projects list when storage is cleared', () => {
    expect(service.projects().length).toBe(0);
    expect(service.filteredProjects().length).toBe(0);
    expect(service.summary().totalBudget).toBe(0);
    expect(service.summary().totalSpent).toBe(0);
    expect(service.summary().totalRemaining).toBe(0);
  });

  it('creates a project, calculates metrics and respects initial budget', async () => {
    const project = await service.addProject({
      name: 'Paseo Fin de Año',
      budgetAmount: 5_000_000,
      person: 'Compartido',
      icon: '✈️',
      color: '#3B82F6',
      status: 'activo',
    });

    expect(service.projects().length).toBe(1);
    expect(project.name).toBe('Paseo Fin de Año');
    expect(project.budgetAmount).toBe(5_000_000);

    const metrics = service.getProjectMetrics(project.id);
    expect(metrics.totalExpenses).toBe(0);
    expect(metrics.remainingBudget).toBe(5_000_000);
    expect(metrics.isOverBudget).toBe(false);
    expect(metrics.progressPercentage).toBe(0);
  });

  it('discounts expenses from budget accurately', async () => {
    const project = await service.addProject({
      name: 'Asado Fin de Semana',
      budgetAmount: 300_000,
      person: 'Charlie',
      icon: '🥩',
      color: '#F59E0B',
      status: 'activo',
    });

    await service.addProjectExpense({
      projectId: project.id,
      date: '2026-10-28',
      description: 'Carne y carbón',
      amount: 180_000,
      person: 'Charlie',
      category: 'Alimentación',
    });

    const metrics = service.getProjectMetrics(project.id);
    expect(metrics.totalExpenses).toBe(180_000);
    expect(metrics.remainingBudget).toBe(120_000);
    expect(metrics.isOverBudget).toBe(false);
    expect(metrics.progressPercentage).toBe(60);
  });

  it('detects over-budget correctly when expenses exceed the planned budget', async () => {
    const project = await service.addProject({
      name: 'Asado con Amigos',
      budgetAmount: 200_000,
      person: 'Compartido',
      icon: '🥩',
      color: '#F43F5E',
      status: 'activo',
    });

    // Gastamos 250.000 de un presupuesto de 200.000
    await service.addProjectExpense({
      projectId: project.id,
      date: '2026-10-28',
      description: 'Compras varias',
      amount: 250_000,
      person: 'Charlie',
      category: 'General',
    });

    const metrics = service.getProjectMetrics(project.id);
    expect(metrics.totalExpenses).toBe(250_000);
    expect(metrics.remainingBudget).toBe(0);
    expect(metrics.isOverBudget).toBe(true);
    expect(metrics.overBudgetAmount).toBe(50_000);
    expect(metrics.progressPercentage).toBe(125);
  });

  it('tracks individual contributions by person for shared projects', async () => {
    const project = await service.addProject({
      name: 'Viaje a Santa Marta',
      budgetAmount: 4_000_000,
      person: 'Compartido',
      icon: '🏖️',
      color: '#06B6D4',
      status: 'activo',
    });

    await service.addProjectExpense({
      projectId: project.id,
      date: '2026-10-15',
      description: 'Tiquetes avión (Charlie)',
      amount: 1_200_000,
      person: 'Charlie',
    });

    await service.addProjectExpense({
      projectId: project.id,
      date: '2026-10-16',
      description: 'Hotel reserva (Benny)',
      amount: 1_500_000,
      person: 'Benny',
    });

    const metrics = service.getProjectMetrics(project.id);
    expect(metrics.totalExpenses).toBe(2_700_000);
    expect(metrics.remainingBudget).toBe(1_300_000);
    expect(metrics.byPerson.Charlie).toBe(1_200_000);
    expect(metrics.byPerson.Benny).toBe(1_500_000);
  });

  it('filters projects by person and status', async () => {
    await service.addProject({
      name: 'Paseo Compartido',
      budgetAmount: 1_000_000,
      person: 'Compartido',
      icon: '✈️',
      color: '#10B981',
      status: 'activo',
    });

    await service.addProject({
      name: 'Curso Charlie',
      budgetAmount: 500_000,
      person: 'Charlie',
      icon: '🎓',
      color: '#F59E0B',
      status: 'activo',
    });

    await service.addProject({
      name: 'Regalo Benny',
      budgetAmount: 300_000,
      person: 'Benny',
      icon: '🎁',
      color: '#3B82F6',
      status: 'completado',
    });

    // Filtro por defecto: activo, Todos
    expect(service.filteredProjects().length).toBe(2);

    // Filtro por Benny
    service.personFilter.set('Benny');
    expect(service.filteredProjects().length).toBe(0); // Porque el de Benny está completado y el filtro es activo

    // Ver completados de Benny
    service.statusFilter.set('completado');
    expect(service.filteredProjects().length).toBe(1);
    expect(service.filteredProjects()[0].name).toBe('Regalo Benny');

    // Ver todos los de Charlie
    service.personFilter.set('Charlie');
    service.statusFilter.set('todos');
    expect(service.filteredProjects().length).toBe(1);
    expect(service.filteredProjects()[0].name).toBe('Curso Charlie');
  });

  it('updates and deletes projects and cascaded expenses', async () => {
    const project = await service.addProject({
      name: 'Proyecto Temporal',
      budgetAmount: 500_000,
      person: 'Charlie',
      icon: '🛠️',
      color: '#3B82F6',
      status: 'activo',
    });

    await service.addProjectExpense({
      projectId: project.id,
      date: '2026-10-20',
      description: 'Herramienta',
      amount: 100_000,
      person: 'Charlie',
    });

    expect(service.projects().length).toBe(1);
    expect(service.projectExpenses().length).toBe(1);

    // Actualizar nombre
    await service.updateProject(project.id, {
      ...project,
      name: 'Proyecto Renombrado',
    });
    expect(service.projects()[0].name).toBe('Proyecto Renombrado');

    // Eliminar proyecto
    await service.deleteProject(project.id);
    expect(service.projects().length).toBe(0);
    expect(service.projectExpenses().length).toBe(0);
  });
});
