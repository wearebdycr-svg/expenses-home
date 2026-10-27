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
import type { ExpensePerson } from '../../data/tc.model';
import { EXPENSE_PERSONS, TC_DEFAULT_CATEGORIES, type TcExpense, type TcExpenseDraft } from '../../data/tc.model';
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';
import { ProjectsService } from '../../../proyectos/data/projects.service';
import { TrmService } from '../../../../core/services/trm.service';

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-tc-form-modal',
  standalone: true,
  imports: [CommonModule, Modal, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tc-form-modal.html',
  styleUrl: './tc-form-modal.css',
})
export class TcFormModal {
  private readonly projectsService = inject(ProjectsService);
  protected readonly trmService = inject(TrmService);

  tcExpense = input<TcExpense | null>(null);
  save = output<TcExpenseDraft>();
  cancel = output<void>();

  protected readonly isEditMode = computed(() => this.tcExpense() !== null);
  protected readonly modalTitle = computed(() =>
    this.isEditMode() ? 'Editar Consumo TC' : 'Registrar Consumo con Tarjeta',
  );
  protected readonly submitLabel = computed(() =>
    this.isEditMode() ? 'Guardar cambios' : 'Registrar consumo',
  );

  protected readonly date = signal(todayIso());
  protected readonly person = signal<ExpensePerson | ''>('');
  protected readonly category = signal<string>('General');
  protected readonly description = signal('');
  protected readonly currency = signal<'COP' | 'USD'>('COP');
  protected readonly amount = signal('');
  protected readonly amountUsd = signal('');
  protected readonly exchangeRate = signal('');
  protected readonly hasSubmitted = signal(false);

  protected readonly amountUsdNumber = computed(() => {
    const val = parseFloat(this.amountUsd());
    return isNaN(val) ? 0 : val;
  });

  protected readonly exchangeRateNumber = computed(() => {
    const val = parseFloat(this.exchangeRate());
    return isNaN(val) || val <= 0 ? this.trmService.trm() : val;
  });

  protected readonly calculatedCopAmount = computed(() => {
    return Math.round(this.amountUsdNumber() * this.exchangeRateNumber());
  });

  protected readonly errors = computed(() => {
    if (!this.hasSubmitted()) return {};
    const errs: Record<string, string> = {};
    if (!this.date()) errs['date'] = 'La fecha es obligatoria';
    if (!this.person()) errs['person'] = 'Debes seleccionar la persona';
    if (!this.description().trim()) errs['description'] = 'La descripción es obligatoria';

    if (this.currency() === 'COP') {
      const numAmount = parseThousands(this.amount());
      if (!this.amount() || numAmount <= 0) errs['amount'] = 'El monto debe ser mayor a 0';
    } else {
      if (this.amountUsdNumber() <= 0) {
        errs['amountUsd'] = 'Ingresa un valor en USD mayor a 0';
      }
      if (this.exchangeRateNumber() <= 0) {
        errs['exchangeRate'] = 'Ingresa una TRM válida';
      }
    }
    return errs;
  });

  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

  protected readonly personOptions: readonly SelectOption<ExpensePerson | ''>[] = EXPENSE_PERSONS.map(
    (person) => ({
      value: person,
      label: person,
    }),
  );

  protected readonly categoryOptions = computed<readonly SelectOption<string>[]>(() => {
    // 1. Categorías por defecto de TC
    const standard: SelectOption<string>[] = TC_DEFAULT_CATEGORIES.map((cat) => ({
      value: cat,
      label: cat,
    }));

    // 2. Proyectos & Eventos activos y vigentes (se descartan si endDate < hoy)
    const activeProjects = this.projectsService.activeProjectCategories();
    const projectOptions: SelectOption<string>[] = activeProjects.map((p) => ({
      value: p.name,
      label: `🎯 ${p.name} (Evento)`,
    }));

    const all = [...standard, ...projectOptions];

    // 3. Preservar categoría si el gasto ya la tenía guardada (ej. evento ya finalizado)
    const currentCat = this.category();
    if (currentCat && !all.some((o) => o.value === currentCat)) {
      all.push({
        value: currentCat,
        label: `${currentCat} (Finalizado)`,
      });
    }

    return all;
  });

  constructor() {
    effect(() => {
      const exp = this.tcExpense();
      if (exp) {
        this.date.set(exp.date);
        this.person.set(exp.person);
        this.category.set(exp.category ?? 'General');
        this.description.set(exp.description);

        if (exp.currency === 'USD' || (exp.amountUsd && exp.amountUsd > 0)) {
          this.currency.set('USD');
          this.amountUsd.set(exp.amountUsd?.toString() || '');
          this.exchangeRate.set((exp.exchangeRate || this.trmService.trm()).toString());
          this.amount.set(formatThousands(exp.amount));
        } else {
          this.currency.set('COP');
          this.amount.set(formatThousands(exp.amount));
          this.amountUsd.set('');
          this.exchangeRate.set(this.trmService.trm().toString());
        }
      } else {
        this.date.set(todayIso());
        this.person.set('');
        this.category.set('General');
        this.description.set('');
        this.currency.set('COP');
        this.amount.set('');
        this.amountUsd.set('');
        this.exchangeRate.set(this.trmService.trm().toString());
      }
      this.hasSubmitted.set(false);
    });
  }

  protected setCurrency(c: 'COP' | 'USD'): void {
    this.currency.set(c);
    if (c === 'USD' && !this.exchangeRate()) {
      this.exchangeRate.set(this.trmService.trm().toString());
    }
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

    const desc = this.description().trim();
    const person = this.person();
    if (!person || !desc) return;

    const isUsd = this.currency() === 'USD';
    const finalCopAmount = isUsd
      ? this.calculatedCopAmount()
      : parseThousands(this.amount());

    this.save.emit({
      date: this.date(),
      person: person as ExpensePerson,
      category: this.category() || 'General',
      description: desc,
      amount: finalCopAmount,
      currency: isUsd ? 'USD' : 'COP',
      amountUsd: isUsd ? this.amountUsdNumber() : undefined,
      exchangeRate: isUsd ? this.exchangeRateNumber() : undefined,
    });
  }
}
