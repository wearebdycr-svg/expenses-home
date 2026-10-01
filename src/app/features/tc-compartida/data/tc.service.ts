import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { PushNotificationService, getWeekDateRange } from '../../../core/services/push-notification.service';
import type { Expense, ExpensePerson, ExpensePersonFilter } from '../../gastos/data/expense.model';
import { EXPENSE_PERSON_COLORS, EXPENSE_PERSONS } from '../../gastos/data/expense.model';
import { ExpensesService } from '../../gastos/data/expenses.service';
import type { TcCard, TcCardDraft, TcCardMetrics, TcCardsSummary } from './tc-card.model';
import { DEFAULT_TC_CARDS, TC_CARD_THEMES, generateCardId } from './tc-card.model';
import type { TcExpense, TcExpenseDraft, TcPersonMetrics } from './tc.model';
import { generateTcExpenseId } from './tc.model';

const STORAGE_KEY = 'expenses_home_tc_v1';
const STORAGE_CARDS_KEY = 'expenses_home_tc_cards_v1';
const CARD_TAG_REGEX = /^\[CARD:([^\]]+)\]\s*(.*)$/i;

export type MonthFilter = number | 'Todos';
export type DayFilter = number | 'Todos';

/**
 * Realiza la amortización FIFO cronológica de consumos con abonos.
 * Un abono en fecha D_pago SOLO puede amortizar consumos realizados en o antes de D_pago (D_consumo <= D_pago).
 * Retorna la suma de saldos pendientes de los consumos amortizados que cumplen con el filtro maxDate.
 */
export function calculateAmortizedPendingDebt(
  expenses: readonly { date: string; amount: number }[],
  payments: readonly { date: string; amount: number }[],
  maxDate?: string,
): number {
  if (expenses.length === 0) return 0;

  // 1. Filtrar y ordenar consumos cronológicamente (más antiguo primero)
  const sortedExpenses = expenses
    .filter((e) => !maxDate || e.date <= maxDate)
    .map((e) => ({ ...e, remaining: e.amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 2. Filtrar y ordenar abonos cronológicamente
  const sortedPayments = payments
    .filter((p) => !maxDate || p.date <= maxDate)
    .map((p) => ({ ...p, remaining: p.amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 3. Aplicar cada abono en orden cronológico a los consumos elegibles (fecha consumo <= fecha abono)
  for (const payment of sortedPayments) {
    if (payment.remaining <= 0) continue;

    for (const exp of sortedExpenses) {
      if (exp.remaining <= 0) continue;
      // Un abono no puede pagar un consumo que ocurrió después del abono
      if (exp.date > payment.date) continue;

      const deduct = Math.min(payment.remaining, exp.remaining);
      exp.remaining -= deduct;
      payment.remaining -= deduct;

      if (payment.remaining <= 0) break;
    }
  }

  // 4. La deuda pendiente es la suma de los remanentes de los consumos
  return sortedExpenses.reduce((sum, exp) => sum + exp.remaining, 0);
}

@Injectable({ providedIn: 'root' })
export class TcService {
  private readonly supabase = inject(SupabaseService);
  private readonly expensesService = inject(ExpensesService);
  private readonly toastService = inject(ToastService);
  private readonly pushNotificationService = inject(PushNotificationService);

  // Tarjetas registradas
  private readonly cardsSignal = signal<TcCard[]>(this.loadCardsFromStorage());
  readonly cards = this.cardsSignal.asReadonly();

  // Tarjeta seleccionada actualmente (null = Vista General de Cards)
  readonly selectedCard = signal<TcCard | null>(null);

  // Consumos cargados (todos)
  private readonly tcExpenses = signal<TcExpense[]>([]);
  readonly allTcExpenses = this.tcExpenses.asReadonly();

  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  private lastLocalMutationTime = 0;

  // Filtros de fecha y responsable
  readonly year = signal<number>(new Date().getFullYear());
  readonly month = signal<MonthFilter>(new Date().getMonth() + 1);
  readonly day = signal<DayFilter>('Todos');
  readonly person = signal<ExpensePersonFilter>('Todos');
  readonly searchQuery = signal<string>('');

  // Alias para retrocompatibilidad
  readonly personFilter = this.person.asReadonly();

  constructor() {
    this.loadFromStorage();
    this.loadTcExpenses();
    this.setupRealtime();
  }

  // ==========================================
  // GESTIÓN DE TARJETAS (CARDS)
  // ==========================================

  selectCard(card: TcCard | null): void {
    this.selectedCard.set(card);
    if (card) {
      // Si la tarjeta pertenece a una persona específica (no Compartido), podemos orientar el filtro
      if (card.person !== 'Compartido') {
        this.person.set('Todos');
      }
    }
  }

  addCard(draft: TcCardDraft): TcCard {
    const theme = TC_CARD_THEMES.find((t) => t.id === draft.themeId) ?? TC_CARD_THEMES[0];
    const newCard: TcCard = {
      ...draft,
      id: generateCardId(draft.name),
      color: theme.primaryColor,
      gradient: theme.gradient,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    this.cardsSignal.update((list) => {
      const updated = [...list, newCard];
      this.saveCardsToStorage(updated);
      return updated;
    });

    this.toastService.success(`Tarjeta "${newCard.name}" creada con éxito`);
    return newCard;
  }

  updateCard(id: string, draft: TcCardDraft): void {
    const theme = TC_CARD_THEMES.find((t) => t.id === draft.themeId) ?? TC_CARD_THEMES[0];
    this.cardsSignal.update((list) => {
      const updated = list.map((card) => {
        if (card.id === id) {
          return {
            ...card,
            ...draft,
            color: theme.primaryColor,
            gradient: theme.gradient,
          };
        }
        return card;
      });
      this.saveCardsToStorage(updated);
      return updated;
    });

    if (this.selectedCard()?.id === id) {
      const updatedCard = this.cardsSignal().find((c) => c.id === id) ?? null;
      this.selectedCard.set(updatedCard);
    }
    this.toastService.success('Tarjeta actualizada');
  }

  deleteCard(id: string): void {
    const card = this.cardsSignal().find((c) => c.id === id);
    if (!card) return;

    this.cardsSignal.update((list) => {
      const updated = list.filter((c) => c.id !== id);
      this.saveCardsToStorage(updated);
      return updated;
    });

    if (this.selectedCard()?.id === id) {
      this.selectedCard.set(null);
    }
    this.toastService.success(`Tarjeta "${card.name}" eliminada`);
  }

  // ==========================================
  // FILTRADO Y COMPUTED SEGÚN TARJETA ACTIVA
  // ==========================================

  /**
   * Consumos correspondientes a la tarjeta actualmente seleccionada
   * (o todos si no hay tarjeta seleccionada)
   */
  readonly currentCardExpenses = computed<TcExpense[]>(() => {
    const card = this.selectedCard();
    if (!card) return this.tcExpenses();
    return this.tcExpenses().filter((exp) => (exp.cardId || 'tc-compartida') === card.id);
  });

  /**
   * Identifica si un gasto de amortización corresponde a una tarjeta dada.
   * Evita sobre-coincidencia accidental con gastos comunes de la misma entidad o palabras generales.
   */
  isPaymentForCard(expense: Expense, card: TcCard): boolean {
    const expCat = (expense.category || '').trim();

    // 1. Coincidencia directa por categoría seleccionada en Gastos Diarios
    if (card.id === 'tc-compartida') {
      if (
        expCat === 'TC-compartida' ||
        expCat === card.name ||
        expCat === `TC: ${card.name}` ||
        expCat === `Tarjeta: ${card.name}`
      ) {
        return true;
      }
    } else {
      if (
        expCat === `TC: ${card.name}` ||
        expCat === card.name ||
        expCat === card.id ||
        (card.paymentCategory &&
          card.paymentCategory !== 'TC-compartida' &&
          card.paymentCategory !== 'Deudas' &&
          expCat === card.paymentCategory)
      ) {
        return true;
      }
    }

    const desc = (expense.description || '').toLowerCase();
    const bank = (card.bank || '').toLowerCase();
    const name = (card.name || '').toLowerCase();
    const digits = (card.lastDigits || '').trim();

    const isDebtCategory =
      expCat === 'Deudas' ||
      expCat === 'Financiero' ||
      expCat === 'Tarjetas de Crédito' ||
      (card.paymentCategory && expCat === card.paymentCategory);

    // 2. Por últimos 4 dígitos en descripción cuando sea categoría de deudas o mencione pago/abono/tc
    if (digits.length >= 4 && desc.includes(digits)) {
      if (
        isDebtCategory ||
        desc.includes('pago') ||
        desc.includes('abono') ||
        desc.includes('tc') ||
        desc.includes('tarjeta')
      ) {
        return true;
      }
    }

    // 3. Si coincide categoría de deuda y menciona banco o nombre de la tarjeta
    if (isDebtCategory) {
      if (name && desc.includes(name)) return true;
      if (bank && bank.length >= 3 && desc.includes(bank)) {
        if (
          desc.includes('tc') ||
          desc.includes('tarjeta') ||
          desc.includes('pago') ||
          desc.includes('abono')
        ) {
          return true;
        }
      }
    }

    // 4. Si la descripción menciona explícitamente pago/abono de tarjeta
    const isExplicitCardPayment =
      desc.includes('pago tc') ||
      desc.includes('abono tc') ||
      desc.includes('pago tarjeta') ||
      desc.includes('abono tarjeta') ||
      desc.includes('pago cuota tc') ||
      desc.includes('abono cuota tc');

    if (isExplicitCardPayment) {
      if (digits.length >= 4 && desc.includes(digits)) return true;
      if (name && desc.includes(name)) return true;
      if (bank && bank.length >= 3 && desc.includes(bank)) return true;
      // Si no menciona otra tarjeta específica y es la tarjeta compartida principal
      if (card.id === 'tc-compartida' && !desc.includes('nu')) return true;
    }

    return false;
  }

  /**
   * Todos los abonos amortizados hacia la tarjeta seleccionada:
   * (Si no hay tarjeta seleccionada, usa la categoría general "TC-compartida" para retrocompatibilidad)
   */
  readonly payments = computed<Expense[]>(() => {
    const card = this.selectedCard();
    const all = this.expensesService.allExpenses();
    if (!card) {
      return all
        .filter((exp) => exp.category === 'TC-compartida')
        .sort((a, b) => b.date.localeCompare(a.date));
    }

    return all
      .filter((exp) => this.isPaymentForCard(exp, card))
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  /**
   * Consumos de TC filtrados por Año, Mes y Persona
   */
  readonly monthlyTcExpenses = computed<TcExpense[]>(() => {
    const year = this.year();
    const month = this.month();
    const person = this.person();

    return this.currentCardExpenses().filter((exp) => {
      const [y, m] = exp.date.split('-').map(Number);
      const matchesYear = y === year;
      const matchesMonth = month === 'Todos' || m === month;
      const matchesPerson = person === 'Todos' || exp.person === person;
      return matchesYear && matchesMonth && matchesPerson;
    });
  });

  /**
   * Abonos filtrados por Año, Mes y Persona
   */
  readonly monthlyPayments = computed<Expense[]>(() => {
    const year = this.year();
    const month = this.month();
    const person = this.person();

    return this.payments().filter((p) => {
      const [y, m] = p.date.split('-').map(Number);
      const matchesYear = y === year;
      const matchesMonth = month === 'Todos' || m === month;
      const matchesPerson = person === 'Todos' || p.person === person;
      return matchesYear && matchesMonth && matchesPerson;
    });
  });

  /** Consumos filtrados por Año, Mes, Día, Persona y búsqueda de texto */
  readonly filteredTcExpenses = computed<TcExpense[]>(() => {
    const day = this.day();
    const query = this.searchQuery().trim().toLowerCase();

    return this.monthlyTcExpenses()
      .filter((exp) => {
        const [, , d] = exp.date.split('-').map(Number);
        const matchesDay = day === 'Todos' || d === day;
        const matchesQuery =
          !query ||
          exp.description.toLowerCase().includes(query) ||
          (exp.category && exp.category.toLowerCase().includes(query));
        return matchesDay && matchesQuery;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  /** Abonos filtrados por Año, Mes, Día y Persona */
  readonly filteredPayments = computed<Expense[]>(() => {
    const day = this.day();

    return this.monthlyPayments()
      .filter((p) => {
        const [, , d] = p.date.split('-').map(Number);
        return day === 'Todos' || d === day;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  /** Total consumos del período seleccionado */
  readonly totalConsumptions = computed<number>(() => {
    return this.filteredTcExpenses().reduce((sum, item) => sum + item.amount, 0);
  });

  /** Total abonos del período seleccionado */
  readonly totalPayments = computed<number>(() => {
    return this.filteredPayments().reduce((sum, item) => sum + item.amount, 0);
  });

  /**
   * Deuda Pendiente TC (Saldo real acumulado amortizado):
   * Calcula la deuda pendiente real acumulada de la tarjeta hasta el período seleccionado
   * aplicando amortización cronológica FIFO (un abono amortiza consumos con fecha <= fecha del abono).
   */
  readonly pendingDebt = computed<number>(() => {
    const card = this.selectedCard();
    const cardId = card?.id || 'tc-compartida';
    const year = this.year();
    const month = this.month();
    const day = this.day();
    const person = this.person();

    // Fecha límite superior según los filtros seleccionados
    let maxDate = `${year}-12-31`;
    if (month !== 'Todos') {
      const monthStr = String(month).padStart(2, '0');
      if (day !== 'Todos') {
        const dayStr = String(day).padStart(2, '0');
        maxDate = `${year}-${monthStr}-${dayStr}`;
      } else {
        const lastDay = new Date(year, Number(month), 0).getDate();
        maxDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
      }
    }

    const cardExpenses = this.tcExpenses().filter(
      (exp) => (exp.cardId || 'tc-compartida') === cardId,
    );

    const cardPayments = card
      ? this.expensesService
          .allExpenses()
          .filter((exp) => this.isPaymentForCard(exp, card))
      : this.expensesService
          .allExpenses()
          .filter((exp) => exp.category === 'TC-compartida');

    const filteredExpenses = cardExpenses.filter(
      (exp) => person === 'Todos' || exp.person === person,
    );
    const filteredPayments = cardPayments.filter(
      (exp) => person === 'Todos' || exp.person === person,
    );

    return calculateAmortizedPendingDebt(filteredExpenses, filteredPayments, maxDate);
  });

  /**
   * Consumos acumulados de TC en la semana en curso (Lunes a Domingo)
   */
  readonly currentWeekTotal = computed<number>(() => {
    const { mondayStr, sundayStr } = getWeekDateRange();
    return this.currentCardExpenses()
      .filter((e) => e.date >= mondayStr && e.date <= sundayStr)
      .reduce((sum, e) => sum + e.amount, 0);
  });

  /** Desglose por responsable/persona para el período seleccionado */
  readonly personMetrics = computed<TcPersonMetrics[]>(() => {
    const year = this.year();
    const month = this.month();
    const day = this.day();

    const periodExpenses = this.currentCardExpenses().filter((exp) => {
      const [y, m, d] = exp.date.split('-').map(Number);
      const matchesYear = y === year;
      const matchesMonth = month === 'Todos' || m === month;
      const matchesDay = day === 'Todos' || d === day;
      return matchesYear && matchesMonth && matchesDay;
    });

    const periodPayments = this.payments().filter((p) => {
      const [y, m, d] = p.date.split('-').map(Number);
      const matchesYear = y === year;
      const matchesMonth = month === 'Todos' || m === month;
      const matchesDay = day === 'Todos' || d === day;
      return matchesYear && matchesMonth && matchesDay;
    });

    const totalCons = periodExpenses.reduce((sum, e) => sum + e.amount, 0);

    return EXPENSE_PERSONS.map((person: ExpensePerson) => {
      const consumptions = periodExpenses
        .filter((e) => e.person === person)
        .reduce((sum, e) => sum + e.amount, 0);

      const payments = periodPayments
        .filter((p) => p.person === person)
        .reduce((sum, p) => sum + p.amount, 0);

      const percentageOfConsumptions =
        totalCons > 0 ? (consumptions / totalCons) * 100 : 0;

      return {
        person,
        consumptions,
        payments,
        netBalance: consumptions - payments,
        percentageOfConsumptions,
        color: EXPENSE_PERSON_COLORS[person] ?? '#94a3b8',
      };
    });
  });

  // ==========================================
  // MÉTRICAS PARA EL GRID DE TARJETAS
  // ==========================================

  getCardMetrics(cardId: string): TcCardMetrics {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const card = this.cardsSignal().find((c) => c.id === cardId);
    const cardExpenses = this.tcExpenses().filter(
      (exp) => (exp.cardId || 'tc-compartida') === cardId,
    );

    const cardPayments = card
      ? this.expensesService
          .allExpenses()
          .filter((exp) => this.isPaymentForCard(exp, card))
      : [];

    const consumptionsThisMonth = cardExpenses
      .filter((e) => {
        const [y, m] = e.date.split('-').map(Number);
        return y === currentYear && m === currentMonth;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    const totalConsumptions = cardExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPayments = cardPayments.reduce((sum, p) => sum + p.amount, 0);
    const pendingDebt = calculateAmortizedPendingDebt(cardExpenses, cardPayments);

    const countThisMonth = cardExpenses.filter((e) => {
      const [y, m] = e.date.split('-').map(Number);
      return y === currentYear && m === currentMonth;
    }).length;

    return {
      consumptionsThisMonth,
      totalConsumptions,
      totalPayments,
      pendingDebt,
      countThisMonth,
      totalCount: cardExpenses.length,
      quota: card?.quota,
      quotaRemaining:
        card?.quota !== undefined ? Math.max(0, card.quota - pendingDebt) : undefined,
    };
  }

  readonly allCardsSummary = computed<TcCardsSummary>(() => {
    const cards = this.cardsSignal();
    let totalConsumptionsMonth = 0;
    let totalPendingDebt = 0;

    for (const card of cards) {
      const metrics = this.getCardMetrics(card.id);
      totalConsumptionsMonth += metrics.consumptionsThisMonth;
      totalPendingDebt += metrics.pendingDebt;
    }

    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;

    const allMonthlyPayments = this.expensesService
      .allExpenses()
      .filter((exp) => {
        const [y, m] = exp.date.split('-').map(Number);
        const isThisMonth = y === curY && m === curM;
        if (!isThisMonth) return false;
        return cards.some((c) => this.isPaymentForCard(exp, c));
      })
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      totalCards: cards.length,
      totalConsumptionsMonth,
      totalPendingDebt,
      totalPaymentsMonth: allMonthlyPayments,
      totalExpensesCount: this.tcExpenses().length,
    };
  });

  // ==========================================
  // SETTERS DE FILTROS
  // ==========================================

  setYear(year: number): void {
    this.year.set(year);
  }

  setMonth(month: MonthFilter): void {
    this.month.set(month);
  }

  setDay(day: DayFilter): void {
    this.day.set(day);
  }

  setPerson(person: ExpensePersonFilter): void {
    this.person.set(person);
  }

  setPersonFilter(person: ExpensePersonFilter): void {
    this.person.set(person);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  // ==========================================
  // OPERACIONES CRUD EN SUPABASE & STORAGE
  // ==========================================

  async loadTcExpenses(): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('tc_expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.warn(
          'Supabase: No se pudieron cargar los consumos de TC (verifica si la tabla tc_expenses existe):',
          error.message,
        );
        this.error.set(error.message);
        return;
      }

      if (data) {
        const mapped: TcExpense[] = data.map((item: any) => {
          const rawDesc = String(item.description || '');
          const match = rawDesc.match(CARD_TAG_REGEX);
          let cardId = 'tc-compartida';
          let cleanDesc = rawDesc;
          if (match) {
            cardId = match[1];
            cleanDesc = match[2];
          }

          return {
            id: String(item.id),
            date: String(item.date),
            person: item.person as ExpensePerson,
            description: cleanDesc,
            amount: Number(item.amount),
            category: item.category ? String(item.category) : 'General',
            cardId,
            createdAt: item.created_at ? String(item.created_at) : undefined,
          };
        });

        this.tcExpenses.set(mapped);
        this.saveToStorage(mapped);
        this.error.set(null);
      }
    } catch (err: any) {
      console.warn('Error al cargar consumos de TC de Supabase:', err);
      this.error.set(err?.message ?? 'Error inesperado de conexión');
    } finally {
      this.loading.set(false);
    }
  }

  async addTcExpense(draft: TcExpenseDraft): Promise<void> {
    this.lastLocalMutationTime = Date.now();
    const tempId = generateTcExpenseId();
    const cardId = draft.cardId || this.selectedCard()?.id || 'tc-compartida';
    const optimisticItem: TcExpense = { ...draft, cardId, id: tempId };

    // Actualización optimista local
    this.tcExpenses.update((list) => {
      const updated = [optimisticItem, ...list];
      this.saveToStorage(updated);
      return updated;
    });

    const dbDescription =
      cardId === 'tc-compartida'
        ? draft.description
        : `[CARD:${cardId}] ${draft.description}`;

    try {
      const { data, error } = await this.supabase.client
        .from('tc_expenses')
        .insert([
          {
            date: draft.date,
            person: draft.person,
            description: dbDescription,
            amount: draft.amount,
            category: draft.category || 'General',
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error insertando consumo TC en Supabase:', error);
        this.error.set(error.message);
        return;
      }

      if (data) {
        this.tcExpenses.update((list) => {
          const updated = list.map((item) =>
            item.id === tempId ? { ...item, id: String(data.id) } : item,
          );
          this.saveToStorage(updated);
          return updated;
        });
      }
      this.toastService.success('Consumo de TC registrado');
      this.pushNotificationService.handleTcExpenseCreated(draft, this.tcExpenses());
    } catch (err: any) {
      console.error('Error de red al insertar consumo TC:', err);
    }
  }

  async updateTcExpense(id: string, draft: TcExpenseDraft): Promise<void> {
    const existing = this.tcExpenses().find((item) => item.id === id);
    const cardId = draft.cardId || existing?.cardId || this.selectedCard()?.id || 'tc-compartida';

    // Actualización optimista
    this.tcExpenses.update((list) => {
      const updated = list.map((item) => (item.id === id ? { ...draft, cardId, id } : item));
      this.saveToStorage(updated);
      return updated;
    });

    const dbDescription =
      cardId === 'tc-compartida'
        ? draft.description
        : `[CARD:${cardId}] ${draft.description}`;

    try {
      const { error } = await this.supabase.client
        .from('tc_expenses')
        .update({
          date: draft.date,
          person: draft.person,
          description: dbDescription,
          amount: draft.amount,
          category: draft.category || 'General',
        })
        .eq('id', id);

      if (error) {
        console.error('Error actualizando consumo TC en Supabase:', error);
        this.error.set(error.message);
        return;
      }
      this.toastService.success('Consumo de TC actualizado');
    } catch (err: any) {
      console.error('Error de red al actualizar consumo TC:', err);
    }
  }

  async deleteTcExpense(id: string): Promise<void> {
    const existing = this.tcExpenses().find((item) => item.id === id);

    // Actualización optimista
    this.tcExpenses.update((list) => {
      const updated = list.filter((item) => item.id !== id);
      this.saveToStorage(updated);
      return updated;
    });

    if (existing) {
      const backupDraft: TcExpenseDraft = {
        date: existing.date,
        person: existing.person,
        description: existing.description,
        amount: existing.amount,
        category: existing.category,
        cardId: existing.cardId,
      };
      this.toastService.success('Consumo de TC eliminado', {
        label: 'Deshacer',
        onClick: () => {
          this.addTcExpense(backupDraft);
        },
      });
    }

    try {
      const { error } = await this.supabase.client
        .from('tc_expenses')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error eliminando consumo TC en Supabase:', error);
        this.error.set(error.message);
      }
    } catch (err: any) {
      console.error('Error de red al eliminar consumo TC:', err);
    }
  }

  private loadCardsFromStorage(): TcCard[] {
    try {
      const stored = localStorage.getItem(STORAGE_CARDS_KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('No se pudieron leer tarjetas de localStorage:', e);
    }
    return [...DEFAULT_TC_CARDS];
  }

  private saveCardsToStorage(cards: TcCard[]): void {
    try {
      localStorage.setItem(STORAGE_CARDS_KEY, JSON.stringify(cards));
    } catch (e) {
      console.warn('No se pudieron guardar tarjetas en localStorage:', e);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.tcExpenses.set(parsed);
        }
      }
    } catch (e) {
      console.warn('No se pudo leer localStorage para TC:', e);
    }
  }

  private saveToStorage(list: TcExpense[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('No se pudo guardar en localStorage para TC:', e);
    }
  }

  private setupRealtime(): void {
    const proc = (globalThis as any).process;
    if (proc?.env?.['NODE_ENV'] === 'test' || proc?.env?.['VITEST']) {
      return;
    }

    try {
      this.supabase.client
        .channel('public:tc_expenses')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tc_expenses' },
          (payload: any) => {
            if (Date.now() - this.lastLocalMutationTime < 2500) {
              return;
            }
            this.loadTcExpenses();
            if (payload?.eventType === 'INSERT' && payload?.new) {
              this.pushNotificationService.notifyIncomingTcExpense(payload.new);
            }
          },
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription no disponible para tc_expenses:', err);
    }
  }
}
