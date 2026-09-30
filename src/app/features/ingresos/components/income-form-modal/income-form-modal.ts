import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Select, type SelectOption } from '../../../../shared/ui/select/select';
import {
  INCOME_SOURCES,
  PERSONS,
  type Income,
  type IncomeDraft,
  type IncomeSource,
  type Person,
} from '../../data/income.model';
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-income-form-modal',
  imports: [Modal, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './income-form-modal.html',
  styleUrl: './income-form-modal.css',
})
export class IncomeFormModal {
  income = input<Income | null>(null);
  save = output<IncomeDraft>();
  cancel = output<void>();

  protected readonly isEditMode = computed(() => this.income() !== null);
  protected readonly modalTitle = computed(() => (this.isEditMode() ? 'Editar Ingreso' : 'Nuevo Ingreso'));
  protected readonly submitLabel = computed(() => (this.isEditMode() ? 'Guardar cambios' : 'Agregar ingreso'));

  protected readonly date = signal(todayIso());
  protected readonly person = signal<Person | ''>('');
  protected readonly source = signal<IncomeSource>('Salario');
  protected readonly description = signal('');
  protected readonly amount = signal('');
  protected readonly hasSubmitted = signal(false);

  protected readonly errors = computed(() => {
    if (!this.hasSubmitted()) return {};
    const errs: Record<string, string> = {};
    if (!this.date()) errs['date'] = 'La fecha es obligatoria';
    if (!this.person()) errs['person'] = 'Debes seleccionar la persona';
    if (!this.source()) errs['source'] = 'Debes seleccionar una fuente';
    if (!this.description().trim()) errs['description'] = 'La descripción es obligatoria';
    const amountVal = parseThousands(this.amount());
    if (!this.amount() || amountVal <= 0) errs['amount'] = 'El monto debe ser mayor a 0';
    return errs;
  });

  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

  protected readonly personOptions: readonly SelectOption<Person | ''>[] = PERSONS.map((person) => ({
    value: person,
    label: person,
  }));

  protected readonly sourceOptions: readonly SelectOption<IncomeSource>[] = INCOME_SOURCES.map((source) => ({
    value: source,
    label: source,
  }));

  constructor() {
    effect(() => {
      const existing = this.income();
      this.date.set(existing?.date ?? todayIso());
      this.person.set(existing?.person ?? '');
      this.source.set(existing?.source ?? 'Salario');
      this.description.set(existing?.description ?? '');
      this.amount.set(existing ? formatThousands(existing.amount) : '');
      this.hasSubmitted.set(false);
    });
  }

  protected onAmountInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const formatted = formatThousands(raw);
    (event.target as HTMLInputElement).value = formatted;
    this.amount.set(formatted);
  }

  protected onSubmit(): void {
    this.hasSubmitted.set(true);
    const description = this.description().trim();
    const amount = parseThousands(this.amount());
    const person = this.person();

    if (!person || !description || !this.amount() || amount <= 0 || !this.date() || !this.source()) {
      return;
    }

    this.save.emit({
      date: this.date(),
      person: person as Person,
      source: this.source(),
      description,
      amount,
    });
  }
}
