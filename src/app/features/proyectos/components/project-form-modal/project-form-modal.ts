import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Select, type SelectOption } from '../../../../shared/ui/select/select';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { ExpensePerson } from '../../../gastos/data/expense.model';
import { EXPENSE_PERSONS } from '../../../gastos/data/expense.model';
import type { Project, ProjectDraft, ProjectStatus, ProjectTheme } from '../../data/project.model';
import { PROJECT_ICONS, PROJECT_THEMES } from '../../data/project.model';
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';

@Component({
  selector: 'app-project-form-modal',
  standalone: true,
  imports: [CommonModule, Modal, Select, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-form-modal.html',
  styleUrl: './project-form-modal.css',
})
export class ProjectFormModal {
  project = input<Project | null>(null);
  save = output<ProjectDraft>();
  cancel = output<void>();

  protected readonly isEditMode = computed(() => this.project() !== null);
  protected readonly modalTitle = computed(() =>
    this.isEditMode() ? 'Editar Proyecto / Evento' : 'Nuevo Proyecto o Evento',
  );

  protected readonly icons = PROJECT_ICONS;
  protected readonly themes = PROJECT_THEMES;

  // Form signals
  protected readonly name = signal('');
  protected readonly budgetAmount = signal('');
  protected readonly person = signal<ExpensePerson>('Compartido');
  protected readonly icon = signal('✈️');
  protected readonly color = signal('#3B82F6');
  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly status = signal<ProjectStatus>('activo');
  protected readonly description = signal('');
  protected readonly hasSubmitted = signal(false);

  protected readonly personOptions: readonly SelectOption<ExpensePerson>[] = EXPENSE_PERSONS.map(
    (p) => ({
      value: p,
      label: p,
    }),
  );

  protected readonly statusOptions: readonly SelectOption<ProjectStatus>[] = [
    { value: 'activo', label: '🟢 Activo (En curso)' },
    { value: 'completado', label: '✅ Completado' },
    { value: 'archivado', label: '📦 Archivado' },
  ];

  protected readonly errors = computed(() => {
    if (!this.hasSubmitted()) return {};
    const errs: Record<string, string> = {};
    if (!this.name().trim()) errs['name'] = 'El nombre del proyecto es obligatorio';
    const amount = parseThousands(this.budgetAmount());
    if (amount <= 0) errs['budgetAmount'] = 'Ingresa un presupuesto mayor a cero';
    return errs;
  });

  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

  constructor() {
    effect(() => {
      const current = this.project();
      if (current) {
        this.name.set(current.name);
        this.budgetAmount.set(formatThousands(current.budgetAmount));
        this.person.set(current.person);
        this.icon.set(current.icon || '✈️');
        this.color.set(current.color || '#3B82F6');
        this.startDate.set(current.startDate || '');
        this.endDate.set(current.endDate || '');
        this.status.set(current.status || 'activo');
        this.description.set(current.description || '');
      } else {
        this.name.set('');
        this.budgetAmount.set('');
        this.person.set('Compartido');
        this.icon.set('✈️');
        this.color.set('#3B82F6');
        this.startDate.set('');
        this.endDate.set('');
        this.status.set('activo');
        this.description.set('');
      }
      this.hasSubmitted.set(false);
    });
  }

  protected onAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatThousands(input.value);
    input.value = formatted;
    this.budgetAmount.set(formatted);
  }

  protected selectIcon(emoji: string): void {
    this.icon.set(emoji);
  }

  protected selectTheme(theme: ProjectTheme): void {
    this.color.set(theme.color);
  }

  protected onSubmit(): void {
    this.hasSubmitted.set(true);
    if (this.hasErrors()) return;

    const amount = parseThousands(this.budgetAmount());

    this.save.emit({
      name: this.name().trim(),
      budgetAmount: amount,
      person: this.person(),
      icon: this.icon(),
      color: this.color(),
      startDate: this.startDate() || undefined,
      endDate: this.endDate() || undefined,
      status: this.status(),
      description: this.description().trim() || undefined,
    });
  }
}
