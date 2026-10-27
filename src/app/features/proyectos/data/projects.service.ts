import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { TcService } from '../../tc-compartida/data/tc.service';
import { ExpensesService } from '../../gastos/data/expenses.service';
import type { ExpensePerson, ExpensePersonFilter } from '../../gastos/data/expense.model';
import type {
  Project,
  ProjectDraft,
  ProjectExpense,
  ProjectExpenseDraft,
  ProjectMetrics,
  ProjectStatus,
  ProjectsSummary,
} from './project.model';
import { generateProjectExpenseId, generateProjectId } from './project.model';

const STORAGE_PROJECTS_KEY = 'expenses_home_projects_v1';
const STORAGE_PROJECT_EXPENSES_KEY = 'expenses_home_project_expenses_v1';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly supabase = inject(SupabaseService);
  private readonly toastService = inject(ToastService);
  private readonly tcService = inject(TcService);
  private readonly expensesService = inject(ExpensesService);

  private readonly projectsSignal = signal<Project[]>(this.loadProjectsFromStorage());
  readonly projects = this.projectsSignal.asReadonly();

  private readonly projectExpensesSignal = signal<ProjectExpense[]>(this.loadExpensesFromStorage());
  readonly projectExpenses = this.projectExpensesSignal.asReadonly();

  readonly selectedProject = signal<Project | null>(null);
  readonly personFilter = signal<ExpensePersonFilter>('Todos');
  readonly statusFilter = signal<ProjectStatus | 'todos'>('activo');
  readonly loading = signal<boolean>(false);
  private lastLocalMutationTime = 0;

  constructor() {
    this.loadProjects();
    this.loadProjectExpenses();
    this.setupRealtime();
  }

  // ==========================================
  // COMPUTED SIGNALS
  // ==========================================

  readonly filteredProjects = computed<Project[]>(() => {
    const person = this.personFilter();
    const status = this.statusFilter();

    return this.projectsSignal().filter((p) => {
      const matchPerson = person === 'Todos' || p.person === person;
      const matchStatus = status === 'todos' || p.status === status;
      return matchPerson && matchStatus;
    });
  });

  private getTodayIso(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  /**
   * Proyectos activos y vigentes para ser usados como categoría en TC o Gastos.
   * Se descartan automáticamente cuando su fecha fin (endDate) ya pasó respecto a hoy.
   */
  readonly activeProjectCategories = computed<Project[]>(() => {
    const today = this.getTodayIso();
    return this.projectsSignal().filter((p) => {
      if (p.status !== 'activo') return false;
      if (p.endDate && p.endDate < today) {
        return false;
      }
      return true;
    });
  });

  /**
   * Agrega todos los gastos asociados a un proyecto:
   * 1. Registros directos en la tabla project_expenses
   * 2. Consumos en tc_expenses cuya categoría coincida con el nombre del proyecto
   * 3. Gastos diarios en expenses cuya categoría coincida con el nombre del proyecto
   */
  getAllExpensesForProject(projectId: string): ProjectExpense[] {
    const project = this.projectsSignal().find((p) => p.id === projectId);
    if (!project) return [];

    const projName = project.name.trim().toLowerCase();

    // 1. Gastos directos de Proyectos
    const direct: ProjectExpense[] = this.projectExpensesSignal()
      .filter((e) => e.projectId === projectId)
      .map((e) => ({ ...e, source: (e.source || 'direct') as 'direct' | 'tc' | 'daily' }));

    // 2. Consumos de TC Compartida
    const tcExpenses: ProjectExpense[] = this.tcService
      .allTcExpenses()
      .filter((tc) => {
        const cat = (tc.category || '').trim().toLowerCase();
        return cat === projName || cat === project.id.toLowerCase();
      })
      .map((tc): ProjectExpense => ({
        id: `tc_${tc.id}`,
        projectId: project.id,
        date: tc.date,
        description: tc.description,
        amount: tc.amount,
        person: tc.person,
        category: tc.category || 'TC Compartida',
        createdAt: tc.createdAt,
        source: 'tc',
      }));

    // 3. Gastos Diarios
    const dailyExpenses: ProjectExpense[] = this.expensesService
      .allExpenses()
      .filter((exp) => {
        const cat = (exp.category || '').trim().toLowerCase();
        return cat === projName || cat === project.id.toLowerCase();
      })
      .map((exp): ProjectExpense => ({
        id: `daily_${exp.id}`,
        projectId: project.id,
        date: exp.date,
        description: exp.description,
        amount: exp.amount,
        person: exp.person,
        category: exp.category,
        source: 'daily',
      }));

    return [...direct, ...tcExpenses, ...dailyExpenses];
  }

  readonly currentProjectExpenses = computed<ProjectExpense[]>(() => {
    const current = this.selectedProject();
    if (!current) return [];
    return this.getAllExpensesForProject(current.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  getProjectMetrics(projectId: string): ProjectMetrics {
    const project = this.projectsSignal().find((p) => p.id === projectId);
    const expenses = this.getAllExpensesForProject(projectId);
    const budget = project?.budgetAmount ?? 0;

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const diff = budget - totalExpenses;
    const isOverBudget = diff < 0;
    const overBudgetAmount = isOverBudget ? Math.abs(diff) : 0;
    const remainingBudget = isOverBudget ? 0 : diff;
    const progressPercentage = budget > 0 ? Math.round((totalExpenses / budget) * 100) : 0;

    const byPerson = {
      Charlie: expenses.filter((e) => e.person === 'Charlie').reduce((sum, e) => sum + e.amount, 0),
      Benny: expenses.filter((e) => e.person === 'Benny').reduce((sum, e) => sum + e.amount, 0),
      Compartido: expenses.filter((e) => e.person === 'Compartido').reduce((sum, e) => sum + e.amount, 0),
    };

    return {
      totalExpenses,
      remainingBudget,
      isOverBudget,
      overBudgetAmount,
      progressPercentage,
      expenseCount: expenses.length,
      byPerson,
    };
  }

  readonly currentProjectMetrics = computed<ProjectMetrics | null>(() => {
    const current = this.selectedProject();
    if (!current) return null;
    return this.getProjectMetrics(current.id);
  });

  readonly summary = computed<ProjectsSummary>(() => {
    const list = this.filteredProjects();
    const totalProjects = list.length;
    let totalBudget = 0;
    let totalSpent = 0;

    for (const p of list) {
      totalBudget += p.budgetAmount;
      const metrics = this.getProjectMetrics(p.id);
      totalSpent += metrics.totalExpenses;
    }

    const diff = totalBudget - totalSpent;
    const isOverBudget = diff < 0;
    const totalRemaining = isOverBudget ? 0 : diff;

    return {
      totalProjects,
      totalBudget,
      totalSpent,
      totalRemaining,
      isOverBudget,
    };
  });

  // ==========================================
  // NAVEGACIÓN Y SELECCIÓN
  // ==========================================

  selectProject(project: Project | null): void {
    this.selectedProject.set(project);
  }

  // ==========================================
  // CRUD PROYECTOS / EVENTOS
  // ==========================================

  async loadProjects(): Promise<void> {
    try {
      this.loading.set(true);
      const { data, error } = await this.supabase.client
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase: No se pudieron cargar los proyectos:', error.message);
        return;
      }

      if (data) {
        const mapped: Project[] = data.map((row: any) => ({
          id: String(row.id),
          name: String(row.name),
          budgetAmount: Number(row.budget_amount ?? row.budgetAmount ?? 0),
          person: row.person as ExpensePerson,
          icon: String(row.icon || '🎯'),
          color: String(row.color || '#3B82F6'),
          startDate: row.start_date || row.startDate || undefined,
          endDate: row.end_date || row.endDate || undefined,
          status: (row.status || 'activo') as ProjectStatus,
          description: row.description ? String(row.description) : undefined,
          createdAt: String(row.created_at || new Date().toISOString()),
        }));

        this.projectsSignal.set(mapped);
        this.saveProjectsToStorage(mapped);

        // Actualizar referencia del proyecto seleccionado si está abierto
        const currentSelected = this.selectedProject();
        if (currentSelected) {
          const fresh = mapped.find((p) => p.id === currentSelected.id) ?? null;
          this.selectedProject.set(fresh);
        }
      }
    } catch (err: any) {
      console.warn('Error de red al cargar proyectos:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async addProject(draft: ProjectDraft): Promise<Project> {
    this.lastLocalMutationTime = Date.now();
    const tempId = generateProjectId(draft.name);
    const newProject: Project = {
      ...draft,
      id: tempId,
      createdAt: new Date().toISOString(),
    };

    // Actualización optimista
    this.projectsSignal.update((list) => {
      const updated = [newProject, ...list];
      this.saveProjectsToStorage(updated);
      return updated;
    });

    const payload: Record<string, any> = {
      name: draft.name,
      budget_amount: draft.budgetAmount,
      person: draft.person,
      icon: draft.icon,
      color: draft.color,
      status: draft.status || 'activo',
    };
    if (draft.startDate) payload['start_date'] = draft.startDate;
    if (draft.endDate) payload['end_date'] = draft.endDate;
    if (draft.description) payload['description'] = draft.description;

    try {
      const { data, error } = await this.supabase.client
        .from('projects')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('Error insertando proyecto en Supabase:', error.message);
      } else if (data) {
        newProject.id = String(data.id);
        // Reemplazar tempId con el id real de la BD
        this.projectsSignal.update((list) => {
          const updated = list.map((p) =>
            p.id === tempId ? { ...p, id: String(data.id) } : p,
          );
          this.saveProjectsToStorage(updated);
          return updated;
        });

        if (this.selectedProject()?.id === tempId) {
          this.selectedProject.set({ ...newProject, id: String(data.id) });
        }
      }
    } catch (err) {
      console.error('Error de red al crear proyecto:', err);
    }

    this.toastService.show(`Proyecto "${newProject.name}" creado con éxito`, { type: 'success' });
    return newProject;
  }

  async updateProject(id: string, draft: ProjectDraft): Promise<void> {
    this.lastLocalMutationTime = Date.now();
    this.projectsSignal.update((list) => {
      const updated = list.map((p) =>
        p.id === id ? { ...p, ...draft } : p,
      );
      this.saveProjectsToStorage(updated);
      return updated;
    });

    if (this.selectedProject()?.id === id) {
      const updatedProject = this.projectsSignal().find((p) => p.id === id) ?? null;
      this.selectedProject.set(updatedProject);
    }

    const payload: Record<string, any> = {
      name: draft.name,
      budget_amount: draft.budgetAmount,
      person: draft.person,
      icon: draft.icon,
      color: draft.color,
      status: draft.status,
      start_date: draft.startDate || null,
      end_date: draft.endDate || null,
      description: draft.description || null,
    };

    try {
      const { error } = await this.supabase.client
        .from('projects')
        .update(payload)
        .eq('id', id);

      if (error) {
        console.error('Error actualizando proyecto en Supabase:', error.message);
      }
    } catch (err) {
      console.error('Error de red al actualizar proyecto:', err);
    }

    this.toastService.show('Proyecto actualizado', { type: 'success' });
  }

  async toggleProjectStatus(id: string): Promise<void> {
    const project = this.projectsSignal().find((p) => p.id === id);
    if (!project) return;
    const newStatus: ProjectStatus = project.status === 'activo' ? 'completado' : 'activo';
    await this.updateProject(id, { ...project, status: newStatus });
  }

  async deleteProject(id: string): Promise<void> {
    this.lastLocalMutationTime = Date.now();
    const project = this.projectsSignal().find((p) => p.id === id);
    if (!project) return;

    // Actualización optimista: eliminar proyecto y sus gastos
    this.projectsSignal.update((list) => {
      const updated = list.filter((p) => p.id !== id);
      this.saveProjectsToStorage(updated);
      return updated;
    });

    this.projectExpensesSignal.update((list) => {
      const updated = list.filter((e) => e.projectId !== id);
      this.saveExpensesToStorage(updated);
      return updated;
    });

    if (this.selectedProject()?.id === id) {
      this.selectedProject.set(null);
    }

    try {
      const { error } = await this.supabase.client.from('projects').delete().eq('id', id);
      if (error) {
        console.error('Error eliminando proyecto en Supabase:', error.message);
      }
    } catch (err) {
      console.error('Error de red al eliminar proyecto:', err);
    }

    this.toastService.show(`Proyecto "${project.name}" eliminado`, { type: 'success' });
  }

  // ==========================================
  // CRUD GASTOS DE PROYECTO
  // ==========================================

  async loadProjectExpenses(): Promise<void> {
    try {
      const { data, error } = await this.supabase.client
        .from('project_expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.warn('Supabase: No se pudieron cargar los gastos de proyectos:', error.message);
        return;
      }

      if (data) {
        const mapped: ProjectExpense[] = data.map((row: any) => ({
          id: String(row.id),
          projectId: String(row.project_id || row.projectId),
          date: String(row.date),
          description: String(row.description),
          amount: Number(row.amount),
          person: row.person as ExpensePerson,
          category: row.category ? String(row.category) : 'General',
          createdAt: row.created_at ? String(row.created_at) : undefined,
        }));

        this.projectExpensesSignal.set(mapped);
        this.saveExpensesToStorage(mapped);
      }
    } catch (err: any) {
      console.warn('Error al cargar gastos de proyectos:', err);
    }
  }

  async addProjectExpense(draft: ProjectExpenseDraft): Promise<ProjectExpense> {
    this.lastLocalMutationTime = Date.now();
    const tempId = generateProjectExpenseId();
    const newExpense: ProjectExpense = {
      ...draft,
      id: tempId,
      createdAt: new Date().toISOString(),
    };

    // Actualización optimista
    this.projectExpensesSignal.update((list) => {
      const updated = [newExpense, ...list];
      this.saveExpensesToStorage(updated);
      return updated;
    });

    const payload = {
      project_id: draft.projectId,
      date: draft.date,
      description: draft.description,
      amount: draft.amount,
      person: draft.person,
      category: draft.category || 'General',
    };

    try {
      const { data, error } = await this.supabase.client
        .from('project_expenses')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('Error insertando gasto de proyecto:', error.message);
      } else if (data) {
        newExpense.id = String(data.id);
        this.projectExpensesSignal.update((list) => {
          const updated = list.map((e) =>
            e.id === tempId ? { ...e, id: String(data.id) } : e,
          );
          this.saveExpensesToStorage(updated);
          return updated;
        });
      }
    } catch (err) {
      console.error('Error de red al crear gasto de proyecto:', err);
    }

    // Verificar si con este gasto se sobrepasa el presupuesto
    const metrics = this.getProjectMetrics(draft.projectId);
    if (metrics.isOverBudget) {
      this.toastService.show(
        `⚠️ ¡Presupuesto excedido por $${metrics.overBudgetAmount.toLocaleString('es-CO')}!`,
        { type: 'warning', duration: 4500 },
      );
    } else {
      this.toastService.show('Gasto agregado al proyecto', { type: 'success' });
    }

    return newExpense;
  }

  async updateProjectExpense(id: string, draft: ProjectExpenseDraft): Promise<void> {
    if (id.startsWith('tc_')) {
      this.toastService.show('Este gasto proviene de TC Compartida. Modifícalo desde la sección TC Compartida.', { type: 'info' });
      return;
    }
    if (id.startsWith('daily_')) {
      this.toastService.show('Este gasto proviene de Gastos Diarios. Modifícalo desde la sección Gastos Diarios.', { type: 'info' });
      return;
    }
    this.lastLocalMutationTime = Date.now();
    this.projectExpensesSignal.update((list) => {
      const updated = list.map((e) =>
        e.id === id ? { ...e, ...draft } : e,
      );
      this.saveExpensesToStorage(updated);
      return updated;
    });

    const payload = {
      project_id: draft.projectId,
      date: draft.date,
      description: draft.description,
      amount: draft.amount,
      person: draft.person,
      category: draft.category || 'General',
    };

    try {
      const { error } = await this.supabase.client
        .from('project_expenses')
        .update(payload)
        .eq('id', id);

      if (error) {
        console.error('Error actualizando gasto de proyecto:', error.message);
      }
    } catch (err) {
      console.error('Error de red al actualizar gasto de proyecto:', err);
    }

    this.toastService.show('Gasto actualizado', { type: 'success' });
  }

  async deleteProjectExpense(id: string): Promise<void> {
    if (id.startsWith('tc_')) {
      this.toastService.show('Este gasto proviene de TC Compartida. Cámbiale la categoría o elimínalo desde TC Compartida.', { type: 'info' });
      return;
    }
    if (id.startsWith('daily_')) {
      this.toastService.show('Este gasto proviene de Gastos Diarios. Cámbiale la categoría o elimínalo desde Gastos Diarios.', { type: 'info' });
      return;
    }
    this.lastLocalMutationTime = Date.now();
    this.projectExpensesSignal.update((list) => {
      const updated = list.filter((e) => e.id !== id);
      this.saveExpensesToStorage(updated);
      return updated;
    });

    try {
      const { error } = await this.supabase.client.from('project_expenses').delete().eq('id', id);
      if (error) {
        console.error('Error eliminando gasto de proyecto:', error.message);
      }
    } catch (err) {
      console.error('Error de red al eliminar gasto de proyecto:', err);
    }

    this.toastService.show('Gasto eliminado', { type: 'success' });
  }

  // ==========================================
  // CACHÉ Y PERSISTENCIA LOCAL (OFFLINE FIRST)
  // ==========================================

  private loadProjectsFromStorage(): Project[] {
    try {
      const stored = localStorage.getItem(STORAGE_PROJECTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Error leyendo proyectos de localStorage:', e);
    }
    return [];
  }

  private saveProjectsToStorage(projects: Project[]): void {
    try {
      localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(projects));
    } catch (e) {
      console.warn('Error guardando proyectos en localStorage:', e);
    }
  }

  private loadExpensesFromStorage(): ProjectExpense[] {
    try {
      const stored = localStorage.getItem(STORAGE_PROJECT_EXPENSES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Error leyendo gastos de proyectos de localStorage:', e);
    }
    return [];
  }

  private saveExpensesToStorage(expenses: ProjectExpense[]): void {
    try {
      localStorage.setItem(STORAGE_PROJECT_EXPENSES_KEY, JSON.stringify(expenses));
    } catch (e) {
      console.warn('Error guardando gastos de proyectos en localStorage:', e);
    }
  }

  // ==========================================
  // REALTIME SUBSCRIPTIONS
  // ==========================================

  private setupRealtime(): void {
    const proc = (globalThis as any).process;
    if (proc?.env?.['NODE_ENV'] === 'test' || proc?.env?.['VITEST']) {
      return;
    }

    try {
      this.supabase.client
        .channel('public:projects')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'projects' },
          () => {
            if (Date.now() - this.lastLocalMutationTime < 2500) return;
            this.loadProjects();
          },
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription no disponible para projects:', err);
    }

    try {
      this.supabase.client
        .channel('public:project_expenses')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'project_expenses' },
          () => {
            if (Date.now() - this.lastLocalMutationTime < 2500) return;
            this.loadProjectExpenses();
          },
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription no disponible para project_expenses:', err);
    }
  }
}
