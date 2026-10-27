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
import type { Project, ProjectExpense, ProjectExpenseDraft } from '../../data/project.model';
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';

export const PROJECT_EXPENSE_CATEGORIES = [
  'General',
  'Alimentación',
  'Hospedaje',
  'Transporte & Gasolina',
  'Actividades & Entradas',
  'Compras & Souvenirs',
  'Bebidas & Licores',
  'Imprevistos',
] as const;

@Component({
  selector: 'app-project-expense-modal',
  standalone: true,
  imports: [CommonModule, Modal, Select, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-expense-modal.html',
  styleUrl: './project-expense-modal.css',
})
export class ProjectExpenseModal {
  project = input.required<Project>();
  expense = input<ProjectExpense | null>(null);
  save = output<ProjectExpenseDraft>();
  cancel = output<void>();

  protected readonly isEditMode = computed(() => this.expense() !== null);
  protected readonly modalTitle = computed(() =>
    this.isEditMode() ? 'Editar Gasto del Evento' : 'Registrar Gasto en ' + this.project().name,
  );

  // Form signals
  protected readonly date = signal(new Date().toISOString().split('T')[0]);
  protected readonly description = signal('');
  protected readonly amount = signal('');
  protected readonly person = signal<ExpensePerson>('Compartido');
  protected readonly category = signal('General');
  protected readonly hasSubmitted = signal(false);

  protected readonly personOptions: readonly SelectOption<ExpensePerson>[] = EXPENSE_PERSONS.map(
    (p) => ({
      value: p,
      label: p,
    }),
  );

  protected readonly categoryOptions: readonly SelectOption<string>[] =
    PROJECT_EXPENSE_CATEGORIES.map((c) => ({
      value: c,
      label: c,
    }));

  protected readonly errors = computed(() => {
    if (!this.hasSubmitted()) return {};
    const errs: Record<string, string> = {};
    if (!this.date()) errs['date'] = 'La fecha es obligatoria';
    if (!this.description().trim()) errs['description'] = 'La descripción es obligatoria';
    const num = parseThousands(this.amount());
    if (num <= 0) errs['amount'] = 'Ingresa un valor mayor a cero';
    return errs;
  });

  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

  constructor() {
    effect(() => {
      const current = this.expense();
      if (current) {
        this.date.set(current.date);
        this.description.set(current.description);
        this.amount.set(formatThousands(current.amount));
        this.person.set(current.person);
        this.category.set(current.category || 'General');
      } else {
        this.date.set(new Date().toISOString().split('T')[0]);
        this.description.set('');
        this.amount.set('');
        // Asignar por defecto la persona del proyecto si no es Compartido
        this.person.set(this.project()?.person || 'Compartido');
        this.category.set('General');
      }
      this.hasSubmitted.set(false);
    });
  }

  protected onAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatThousands(input.value);
    input.value = formatted;
    this.amount.set(formatted);
  }

  protected onSubmit(): void {
    this.hasSubmitted.set(true);
    if (this.hasErrors()) return;

    this.save.emit({
      projectId: this.project().id,
      date: this.date(),
      description: this.description().trim(),
      amount: parseThousands(this.amount()),
      person: this.person(),
      category: this.category(),
    });
  }
}
