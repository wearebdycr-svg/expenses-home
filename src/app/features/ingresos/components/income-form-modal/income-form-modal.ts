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
  protected readonly person = signal<Person>('Ana');
  protected readonly source = signal<IncomeSource>('Salario');
  protected readonly description = signal('');
  protected readonly amount = signal('');

  protected readonly personOptions: readonly SelectOption<Person>[] = PERSONS.map((person) => ({
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
      this.person.set(existing?.person ?? 'Ana');
      this.source.set(existing?.source ?? 'Salario');
      this.description.set(existing?.description ?? '');
      this.amount.set(existing ? String(existing.amount) : '');
    });
  }

  protected onAmountInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.amount.set(raw.replace(/[^0-9]/g, ''));
  }

  protected onSubmit(): void {
    const description = this.description().trim();
    const amount = Number(this.amount());
    if (!description || !this.amount() || amount <= 0) {
      return;
    }

    this.save.emit({
      date: this.date(),
      person: this.person(),
      source: this.source(),
      description,
      amount,
    });
  }
}
