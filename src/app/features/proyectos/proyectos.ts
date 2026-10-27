import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../../shared/ui/icon/icon';
import { ProjectsService } from './data/projects.service';
import type {
  Project,
  ProjectDraft,
  ProjectExpense,
  ProjectExpenseDraft,
  ProjectStatus,
} from './data/project.model';
import type { ExpensePersonFilter } from '../gastos/data/expense.model';
import { ProjectCard } from './components/project-card/project-card';
import { ProjectDetail } from './components/project-detail/project-detail';
import { ProjectFormModal } from './components/project-form-modal/project-form-modal';
import { ProjectExpenseModal } from './components/project-expense-modal/project-expense-modal';

@Component({
  selector: 'app-proyectos-page',
  standalone: true,
  imports: [
    CommonModule,
    Icon,
    ProjectCard,
    ProjectDetail,
    ProjectFormModal,
    ProjectExpenseModal,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './proyectos.html',
  styleUrl: './proyectos.css',
})
export class ProyectosPage {
  protected readonly projectsService = inject(ProjectsService);

  // Modals state
  protected readonly isProjectModalOpen = signal(false);
  protected readonly editingProject = signal<Project | null>(null);

  protected readonly isExpenseModalOpen = signal(false);
  protected readonly editingExpense = signal<ProjectExpense | null>(null);

  // --- Project Modal Actions ---
  protected openCreateProject(): void {
    this.editingProject.set(null);
    this.isProjectModalOpen.set(true);
  }

  protected openEditProject(project: Project): void {
    this.editingProject.set(project);
    this.isProjectModalOpen.set(true);
  }

  protected closeProjectModal(): void {
    this.isProjectModalOpen.set(false);
    this.editingProject.set(null);
  }

  protected onSaveProject(draft: ProjectDraft): void {
    const editing = this.editingProject();
    if (editing) {
      this.projectsService.updateProject(editing.id, draft);
    } else {
      this.projectsService.addProject(draft);
    }
    this.closeProjectModal();
  }

  protected onDeleteProject(project: Project): void {
    if (
      confirm(
        `¿Estás seguro de eliminar el proyecto "${project.name}" y todos sus gastos asociados?`,
      )
    ) {
      this.projectsService.deleteProject(project.id);
    }
  }

  protected onToggleStatus(project: Project): void {
    this.projectsService.toggleProjectStatus(project.id);
  }

  // --- Expense Modal Actions ---
  protected openCreateExpense(): void {
    this.editingExpense.set(null);
    this.isExpenseModalOpen.set(true);
  }

  protected openEditExpense(expense: ProjectExpense): void {
    this.editingExpense.set(expense);
    this.isExpenseModalOpen.set(true);
  }

  protected closeExpenseModal(): void {
    this.isExpenseModalOpen.set(false);
    this.editingExpense.set(null);
  }

  protected onSaveExpense(draft: ProjectExpenseDraft): void {
    const editing = this.editingExpense();
    if (editing) {
      this.projectsService.updateProjectExpense(editing.id, draft);
    } else {
      this.projectsService.addProjectExpense(draft);
    }
    this.closeExpenseModal();
  }

  protected onDeleteExpense(expense: ProjectExpense): void {
    if (confirm(`¿Eliminar el gasto "${expense.description}"?`)) {
      this.projectsService.deleteProjectExpense(expense.id);
    }
  }

  // --- Filter Changes ---
  protected onPersonFilterChange(person: ExpensePersonFilter): void {
    this.projectsService.personFilter.set(person);
  }

  protected onStatusFilterChange(status: ProjectStatus | 'todos'): void {
    this.projectsService.statusFilter.set(status);
  }
}
