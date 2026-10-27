import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../../../../shared/ui/icon/icon';
import type {
  Project,
  ProjectExpense,
  ProjectMetrics,
} from '../../data/project.model';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.css',
})
export class ProjectDetail {
  project = input.required<Project>();
  metrics = input.required<ProjectMetrics>();
  expenses = input.required<ProjectExpense[]>();

  back = output<void>();
  editProject = output<Project>();
  toggleStatus = output<Project>();
  addExpense = output<void>();
  editExpense = output<ProjectExpense>();
  deleteExpense = output<ProjectExpense>();

  protected readonly progressColorClass = computed(() => {
    const m = this.metrics();
    if (m.isOverBudget) return 'progress-danger';
    if (m.progressPercentage >= 85) return 'progress-warning';
    return 'progress-success';
  });

  protected readonly progressFillWidth = computed(() => {
    return Math.min(this.metrics().progressPercentage, 100);
  });

  // Category breakdown for small badges
  protected readonly categoryBreakdown = computed(() => {
    const exps = this.expenses();
    const map = new Map<string, number>();
    for (const e of exps) {
      const cat = e.category || 'General';
      map.set(cat, (map.get(cat) || 0) + e.amount);
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  });
}
