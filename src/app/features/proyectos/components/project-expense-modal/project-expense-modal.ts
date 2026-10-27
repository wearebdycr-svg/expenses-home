import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
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
import { TrmService } from '../../../../core/services/trm.service';

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
  protected readonly trmService = inject(TrmService);

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
  protected readonly person = signal<ExpensePerson>('Compartido');
  protected readonly category = signal('General');
  protected readonly currency = signal<'COP' | 'USD'>('COP');
  protected readonly amount = signal('');
  protected readonly amountUsd = signal('');
  protected readonly customTrm = signal<string | null>(null);
  protected readonly hasSubmitted = signal(false);

  protected readonly effectiveTrm = computed<number>(() => {
    const custom = this.customTrm();
    if (custom !== null && custom.trim() !== '') {
      const parsed = parseFloat(custom);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return this.trmService.trm();
  });

  protected readonly displayTrm = computed<string>(() => {
    const custom = this.customTrm();
    if (custom !== null) {
      return custom;
    }
    return this.effectiveTrm().toString();
  });

  protected readonly amountUsdNumber = computed(() => {
    const val = parseFloat(this.amountUsd());
    return isNaN(val) ? 0 : val;
  });

  protected readonly calculatedCopAmount = computed(() => {
    return Math.round(this.amountUsdNumber() * this.effectiveTrm());
  });

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

    if (this.currency() === 'COP') {
      const num = parseThousands(this.amount());
      if (num <= 0) errs['amount'] = 'Ingresa un valor mayor a cero';
    } else {
      if (this.amountUsdNumber() <= 0) {
        errs['amountUsd'] = 'Ingresa un valor en USD mayor a cero';
      }
      if (this.effectiveTrm() <= 0) {
        errs['exchangeRate'] = 'Ingresa una TRM válida';
      }
    }

    return errs;
  });

  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

  constructor() {
    effect(() => {
      const current = this.expense();
      if (current) {
        this.date.set(current.date);
        this.description.set(current.description);
        this.person.set(current.person);
        this.category.set(current.category || 'General');

        if (current.currency === 'USD' || (current.amountUsd && current.amountUsd > 0)) {
          this.currency.set('USD');
          this.amountUsd.set(current.amountUsd?.toString() || '');
          this.customTrm.set(current.exchangeRate != null ? current.exchangeRate.toString() : null);
          this.amount.set(formatThousands(current.amount));
        } else {
          this.currency.set('COP');
          this.amount.set(formatThousands(current.amount));
          this.amountUsd.set('');
          this.customTrm.set(null);
        }
      } else {
        this.date.set(new Date().toISOString().split('T')[0]);
        this.description.set('');
        this.person.set(this.project()?.person || 'Compartido');
        this.category.set('General');
        this.currency.set('COP');
        this.amount.set('');
        this.amountUsd.set('');
        this.customTrm.set(null);
      }
      this.hasSubmitted.set(false);
    });
  }

  protected setCurrency(c: 'COP' | 'USD'): void {
    this.currency.set(c);
  }

  protected onTrmInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.customTrm.set(val);
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

    const isUsd = this.currency() === 'USD';
    const finalCopAmount = isUsd
      ? this.calculatedCopAmount()
      : parseThousands(this.amount());

    this.save.emit({
      projectId: this.project().id,
      date: this.date(),
      description: this.description().trim(),
      amount: finalCopAmount,
      person: this.person(),
      category: this.category(),
      currency: isUsd ? 'USD' : 'COP',
      amountUsd: isUsd ? this.amountUsdNumber() : undefined,
      exchangeRate: isUsd ? this.effectiveTrm() : undefined,
    });
  }
}
