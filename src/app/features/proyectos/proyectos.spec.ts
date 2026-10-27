import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProyectosPage } from './proyectos';
import { ProjectsService } from './data/projects.service';

describe('ProyectosPage', () => {
  let component: ProyectosPage;
  let fixture: ComponentFixture<ProyectosPage>;
  let projectsService: ProjectsService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ProyectosPage],
    }).compileComponents();

    fixture = TestBed.createComponent(ProyectosPage);
    component = fixture.componentInstance;
    projectsService = TestBed.inject(ProjectsService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create the proyectos page', () => {
    expect(component).toBeTruthy();
  });

  it('renders header, top summary KPIs and empty state when no projects exist', () => {
    const el = fixture.nativeElement as HTMLElement;
    const title = el.querySelector('.page-title');
    const subtitle = el.querySelector('.page-subtitle');
    const createBtn = el.querySelector('.btn-primary');

    expect(title?.textContent).toContain('Proyectos & Eventos');
    expect(subtitle?.textContent).toContain('Control de presupuestos');
    expect(createBtn?.textContent).toContain('+ Nuevo Proyecto / Evento');
    expect(el.querySelector('.empty-state')).toBeTruthy();
  });

  it('renders project card when a project is added', async () => {
    await projectsService.addProject({
      name: 'Paseo Eje Cafetero',
      budgetAmount: 3_500_000,
      person: 'Compartido',
      icon: '✈️',
      color: '#10B981',
      status: 'activo',
    });

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state')).toBeFalsy();
    expect(el.querySelector('app-project-card')).toBeTruthy();
    expect(el.textContent).toContain('Paseo Eje Cafetero');
    expect(el.textContent).toContain('3.500.000');
  });

  it('switches to detail view when project is selected', async () => {
    const project = await projectsService.addProject({
      name: 'Asado Cumpleaños',
      budgetAmount: 400_000,
      person: 'Charlie',
      icon: '🥩',
      color: '#F59E0B',
      status: 'activo',
    });

    projectsService.selectProject(project);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-project-detail')).toBeTruthy();
    expect(el.textContent).toContain('Volver a Proyectos');
    expect(el.textContent).toContain('+ Registrar Gasto');
  });
});
