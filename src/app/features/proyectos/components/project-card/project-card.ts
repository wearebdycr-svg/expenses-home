import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { Project, ProjectMetrics } from '../../data/project.model';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [CommonModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-card.html',
  styleUrl: './project-card.css',
})
export class ProjectCard {
  project = input.required<Project>();
  metrics = input.required<ProjectMetrics>();

  view = output<Project>();
  edit = output<Project>();
  toggleStatus = output<Project>();
  delete = output<Project>();

  protected readonly progressColorClass = computed(() => {
    const m = this.metrics();
    if (m.isOverBudget) return 'progress-danger';
    if (m.progressPercentage >= 85) return 'progress-warning';
    return 'progress-success';
  });

  protected readonly progressFillWidth = computed(() => {
    const pct = this.metrics().progressPercentage;
    return Math.min(pct, 100);
  });
}
