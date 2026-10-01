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
import type { CardTheme, TcCard, TcCardDraft } from '../../data/tc-card.model';
import { TC_CARD_THEMES } from '../../data/tc-card.model';
import { formatThousands, parseThousands } from '../../../../shared/utils/format.utils';

@Component({
  selector: 'app-tc-card-modal',
  standalone: true,
  imports: [CommonModule, Modal, Select, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tc-card-modal.html',
  styleUrl: './tc-card-modal.css',
})
export class TcCardModal {
  card = input<TcCard | null>(null);
  save = output<TcCardDraft>();
  cancel = output<void>();

  protected readonly isEditMode = computed(() => this.card() !== null);
  protected readonly modalTitle = computed(() =>
    this.isEditMode() ? 'Editar Tarjeta de Crédito' : 'Nueva Tarjeta de Crédito',
  );
  protected readonly submitLabel = computed(() =>
    this.isEditMode() ? 'Guardar Cambios' : 'Crear Tarjeta',
  );

  protected readonly themes = TC_CARD_THEMES;

  // Form signals
  protected readonly name = signal('');
  protected readonly bank = signal('');
  protected readonly lastDigits = signal('');
  protected readonly person = signal<ExpensePerson | ''>('Compartido');
  protected readonly themeId = signal<string>('emerald');
  protected readonly quota = signal('');
  protected readonly paymentCategory = signal('TC-compartida');
  protected readonly description = signal('');
  protected readonly hasSubmitted = signal(false);

  protected readonly selectedTheme = computed<CardTheme>(() => {
    return this.themes.find((t) => t.id === this.themeId()) ?? this.themes[0];
  });

  protected readonly personOptions: readonly SelectOption<ExpensePerson | ''>[] = EXPENSE_PERSONS.map(
    (person) => ({
      value: person,
      label: person,
    }),
  );

  protected readonly categoryOptions: readonly SelectOption<string>[] = [
    { value: 'TC-compartida', label: 'TC-compartida' },
    { value: 'Deudas', label: 'Deudas' },
    { value: 'Otros', label: 'Otros' },
  ];

  protected readonly errors = computed(() => {
    if (!this.hasSubmitted()) return {};
    const errs: Record<string, string> = {};
    if (!this.name().trim()) errs['name'] = 'El nombre de la tarjeta es obligatorio';
    if (!this.bank().trim()) errs['bank'] = 'El banco o entidad emisora es obligatorio';
    const digits = this.lastDigits().trim();
    if (!digits || digits.length < 4 || !/^\d{4}$/.test(digits)) {
      errs['lastDigits'] = 'Ingresa los últimos 4 dígitos numéricos';
    }
    if (!this.person()) errs['person'] = 'Debes seleccionar el titular / responsable';
    return errs;
  });

  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);

  constructor() {
    effect(() => {
      const current = this.card();
      if (current) {
        this.name.set(current.name);
        this.bank.set(current.bank);
        this.lastDigits.set(current.lastDigits);
        this.person.set(current.person);
        this.themeId.set(current.themeId);
        this.quota.set(current.quota ? formatThousands(current.quota) : '');
        this.paymentCategory.set(current.paymentCategory ?? 'TC-compartida');
        this.description.set(current.description ?? '');
      } else {
        this.name.set('');
        this.bank.set('');
        this.lastDigits.set('');
        this.person.set('Compartido');
        this.themeId.set('emerald');
        this.quota.set('');
        this.paymentCategory.set('TC-compartida');
        this.description.set('');
      }
      this.hasSubmitted.set(false);
    });
  }

  protected onDigitsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/\D/g, '').slice(0, 4);
    input.value = clean;
    this.lastDigits.set(clean);
  }

  protected onQuotaInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatThousands(input.value);
    input.value = formatted;
    this.quota.set(formatted);
  }

  protected selectTheme(themeId: string): void {
    this.themeId.set(themeId);
  }

  protected onSubmit(): void {
    this.hasSubmitted.set(true);
    if (this.hasErrors()) {
      return;
    }

    const quotaNum = parseThousands(this.quota());

    this.save.emit({
      name: this.name().trim(),
      bank: this.bank().trim(),
      lastDigits: this.lastDigits().trim(),
      person: this.person() as ExpensePerson,
      themeId: this.themeId(),
      quota: quotaNum > 0 ? quotaNum : undefined,
      paymentCategory: this.paymentCategory().trim() || 'TC-compartida',
      description: this.description().trim() || undefined,
    });
  }
}
