import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { ExpensesService } from '../../gastos/data/expenses.service';
import type { ExpensePerson } from '../../gastos/data/expense.model';
import type {
  FixedExpense,
  FixedExpenseDraft,
  FixedExpenseMonthlyStatus,
  FixedExpensesSummary,
  ResultadoCalculoVencimiento,
} from './fixed-expense.model';
import { calcularVencimientoGastoFijo } from '../utils/due-date-calculator';

const STORAGE_FIXED_EXPENSES_KEY = 'expenses_home_fixed_expenses_v1';

interface FixedExpenseDatabaseRow {
  id: string | number;
  name: string;
  expected_amount?: number;
  expectedAmount?: number;
  person?: string;
  due_day?: number;
  dia_limite_mes?: number;
  dias_anticipacion_alerta?: number;
  status?: string;
  notes?: string;
  created_at?: string;
}

@Injectable({ providedIn: 'root' })
export class FixedExpensesService {
  private readonly supabase = inject(SupabaseService);
  private readonly toastService = inject(ToastService);
  private readonly pushNotificationService = inject(PushNotificationService);
  private readonly expensesService = inject(ExpensesService);

  private readonly fixedExpensesSignal = signal<FixedExpense[]>(this.loadFromStorage());
  readonly fixedExpenses = this.fixedExpensesSignal.asReadonly();

  readonly selectedYear = signal<number>(new Date().getFullYear());
  readonly selectedMonth = signal<number>(new Date().getMonth() + 1);
  readonly selectedPerson = signal<ExpensePerson | 'Todos'>('Todos');
  readonly loading = signal<boolean>(false);
  private lastLocalMutationTime = 0;

  constructor() {
    this.loadFixedExpenses();
    this.setupRealtime();
  }

  /**
   * Gastos fijos activos disponibles para selección en categorías
   */
  readonly activeFixedExpenses = computed<FixedExpense[]>(() => {
    return this.fixedExpensesSignal().filter((f) => f.status === 'activo');
  });

  /**
   * Lista filtrada de gastos fijos según persona seleccionada
   */
  readonly filteredFixedExpenses = computed<FixedExpense[]>(() => {
    const person = this.selectedPerson();
    const list = this.activeFixedExpenses();
    if (person === 'Todos') return list;
    return list.filter((f) => f.person === person || f.person === 'Compartido');
  });

  /**
   * Determina el estado de pago de cada gasto fijo para el mes y año seleccionados.
   * Un gasto fijo se considera pagado si en el mes/año existe un gasto cuyo category coincida
   * exactamente con el nombre del gasto fijo (o "Fijo: [Nombre]") o cuya descripción lo mencione explícitamente.
   */
  readonly monthlyStatuses = computed<FixedExpenseMonthlyStatus[]>(() => {
    const fixedList = this.filteredFixedExpenses();
    const year = this.selectedYear();
    const month = this.selectedMonth();
    const allExpenses = this.expensesService.allExpenses();

    // Filtrar gastos correspondientes al mes y año
    const monthExpenses = allExpenses.filter((e) => {
      if (!e.date) return false;
      const [y, m] = e.date.split('-').map(Number);
      return y === year && m === month;
    });

    const today = new Date();
    const isCurrentPeriod = today.getFullYear() === year && today.getMonth() + 1 === month;
    const refDateIso = isCurrentPeriod
      ? `${year}-${String(month).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      : `${year}-${String(month).padStart(2, '0')}-01`;

    return fixedList.map((fixed) => {
      const fixedNameNorm = fixed.name.trim().toLowerCase();

      // Calcular estado de vencimiento determinista si tiene día límite asignado
      const diaLimite = fixed.dia_limite_mes ?? fixed.dueDay;
      let vencimiento: ResultadoCalculoVencimiento | undefined;
      if (diaLimite != null && diaLimite >= 1 && diaLimite <= 31) {
        vencimiento = calcularVencimientoGastoFijo(
          {
            id: fixed.id,
            nombre: fixed.name,
            monto: fixed.expectedAmount,
            dia_limite_mes: diaLimite,
            dias_anticipacion_alerta: fixed.dias_anticipacion_alerta ?? 3,
          },
          refDateIso
        );
      }

      // Buscar si existe un gasto asociado a este gasto fijo en este mes
      const matching = monthExpenses.find((e) => {
        const catNorm = (e.category || '').trim().toLowerCase();
        const descNorm = (e.description || '').trim().toLowerCase();

        return (
          catNorm === fixedNameNorm ||
          catNorm === `fijo: ${fixedNameNorm}` ||
          catNorm === `gasto fijo: ${fixedNameNorm}` ||
          descNorm === fixedNameNorm ||
          descNorm.includes(fixedNameNorm)
        );
      });

      if (matching) {
        return {
          fixedExpense: fixed,
          isPaid: true,
          paidAmount: matching.amount,
          paidDate: matching.date,
          expenseId: matching.id,
          expenseDescription: matching.description,
          vencimiento,
        };
      }

      return {
        fixedExpense: fixed,
        isPaid: false,
        paidAmount: 0,
        vencimiento,
      };
    });
  });

  /**
   * Resumen y KPIs del mes seleccionado
   */
  readonly summary = computed<FixedExpensesSummary>(() => {
    const statuses = this.monthlyStatuses();
    const totalFixed = statuses.length;
    let totalExpectedAmount = 0;
    let totalPaidAmount = 0;
    let paidCount = 0;

    for (const s of statuses) {
      totalExpectedAmount += s.fixedExpense.expectedAmount;
      if (s.isPaid) {
        paidCount++;
        totalPaidAmount += s.paidAmount;
      }
    }

    const pendingCount = totalFixed - paidCount;
    const totalPendingAmount = Math.max(0, totalExpectedAmount - totalPaidAmount);
    const progressPercentage =
      totalFixed > 0 ? Math.round((paidCount / totalFixed) * 100) : 0;

    return {
      totalFixed,
      totalExpectedAmount,
      totalPaidAmount,
      totalPendingAmount,
      paidCount,
      pendingCount,
      progressPercentage,
    };
  });

  // ==========================================
  // HISTÓRICO ANUAL (EVALUACIÓN MES A MES)
  // ==========================================

  /**
   * Calcula el histórico de pagos (enero a diciembre) para un gasto fijo dado en un año
   */
  getYearlyHistoryForFixedExpense(
    fixedExpenseId: string,
    year: number,
  ): { month: number; isPaid: boolean; amount: number; date?: string }[] {
    const fixed = this.fixedExpensesSignal().find((f) => f.id === fixedExpenseId);
    if (!fixed) return [];

    const fixedNameNorm = fixed.name.trim().toLowerCase();
    const allExpenses = this.expensesService.allExpenses();

    const history = [];
    for (let m = 1; m <= 12; m++) {
      const matching = allExpenses.find((e) => {
        if (!e.date) return false;
        const [y, expMonth] = e.date.split('-').map(Number);
        if (y !== year || expMonth !== m) return false;

        const catNorm = (e.category || '').trim().toLowerCase();
        const descNorm = (e.description || '').trim().toLowerCase();

        return (
          catNorm === fixedNameNorm ||
          catNorm === `fijo: ${fixedNameNorm}` ||
          catNorm === `gasto fijo: ${fixedNameNorm}` ||
          descNorm === fixedNameNorm ||
          descNorm.includes(fixedNameNorm)
        );
      });

      history.push({
        month: m,
        isPaid: Boolean(matching),
        amount: matching ? matching.amount : 0,
        date: matching ? matching.date : undefined,
      });
    }

    return history;
  }

  // ==========================================
  // CRUD GASTOS FIJOS
  // ==========================================

  async loadFixedExpenses(): Promise<void> {
    try {
      this.loading.set(true);
      const { data, error } = await this.supabase.client
        .from('fixed_expenses')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('Supabase: No se pudieron cargar los gastos fijos:', error.message);
        return;
      }

      if (data) {
        const rows = data as unknown as FixedExpenseDatabaseRow[];
        const mapped: FixedExpense[] = rows.map((row) => {
          const diaLimite =
            row.dia_limite_mes != null
              ? Number(row.dia_limite_mes)
              : row.due_day != null
                ? Number(row.due_day)
                : undefined;
          const anticipacion =
            row.dias_anticipacion_alerta != null
              ? Number(row.dias_anticipacion_alerta)
              : undefined;

          return {
            id: String(row.id),
            name: String(row.name),
            expectedAmount: Number(row.expected_amount ?? row.expectedAmount ?? 0),
            person: (row.person as ExpensePerson) || 'Compartido',
            dueDay: diaLimite,
            dia_limite_mes: diaLimite,
            dias_anticipacion_alerta: anticipacion,
            status: (row.status || 'activo') as 'activo' | 'inactivo',
            notes: row.notes ? String(row.notes) : undefined,
            createdAt: String(row.created_at || new Date().toISOString()),
          };
        });

        this.fixedExpensesSignal.set(mapped);
        this.saveToStorage(mapped);
      }
    } catch (err: unknown) {
      console.warn('Error de red al cargar gastos fijos:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async addFixedExpense(draft: FixedExpenseDraft): Promise<FixedExpense> {
    this.lastLocalMutationTime = Date.now();
    const tempId = `fe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const diaLimite = draft.dia_limite_mes ?? draft.dueDay;
    const newFixed: FixedExpense = {
      ...draft,
      id: tempId,
      dueDay: diaLimite,
      dia_limite_mes: diaLimite,
      dias_anticipacion_alerta: draft.dias_anticipacion_alerta,
      createdAt: new Date().toISOString(),
    };

    // Actualización optimista
    this.fixedExpensesSignal.update((list) => {
      const updated = [newFixed, ...list];
      this.saveToStorage(updated);
      return updated;
    });

    const payload: Record<string, unknown> = {
      name: draft.name,
      expected_amount: draft.expectedAmount,
      person: draft.person,
      status: draft.status || 'activo',
    };
    if (diaLimite != null) {
      payload['due_day'] = diaLimite;
      payload['dia_limite_mes'] = diaLimite;
    }
    if (draft.dias_anticipacion_alerta != null) {
      payload['dias_anticipacion_alerta'] = draft.dias_anticipacion_alerta;
    }
    if (draft.notes) payload['notes'] = draft.notes;

    try {
      let { data, error } = await this.supabase.client
        .from('fixed_expenses')
        .insert([payload])
        .select()
        .single();

      // Fallback defensivo si la base de datos aún no tiene las nuevas columnas
      if (error && error.message.includes('schema cache')) {
        const fallbackPayload: Record<string, unknown> = { ...payload };
        delete fallbackPayload['dia_limite_mes'];
        delete fallbackPayload['dias_anticipacion_alerta'];
        const retry = await this.supabase.client
          .from('fixed_expenses')
          .insert([fallbackPayload])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Error insertando gasto fijo en Supabase:', error.message);
        this.toastService.show(`Guardado localmente. (BD: ${error.message})`, { type: 'warning' });
      } else if (data) {
        newFixed.id = String(data.id);
        this.fixedExpensesSignal.update((list) => {
          const updated = list.map((f) => (f.id === tempId ? { ...f, id: String(data.id) } : f));
          this.saveToStorage(updated);
          return updated;
        });
        this.toastService.show(`Gasto fijo "${newFixed.name}" creado con éxito`, { type: 'success' });
      }
    } catch (err) {
      console.error('Error de red al crear gasto fijo:', err);
    }

    return newFixed;
  }

  async updateFixedExpense(id: string, draft: FixedExpenseDraft): Promise<void> {
    this.lastLocalMutationTime = Date.now();
    const diaLimite = draft.dia_limite_mes ?? draft.dueDay;
    this.fixedExpensesSignal.update((list) => {
      const updated = list.map((f) =>
        f.id === id
          ? {
              ...f,
              ...draft,
              dueDay: diaLimite,
              dia_limite_mes: diaLimite,
              dias_anticipacion_alerta: draft.dias_anticipacion_alerta,
            }
          : f,
      );
      this.saveToStorage(updated);
      return updated;
    });

    const payload: Record<string, unknown> = {
      name: draft.name,
      expected_amount: draft.expectedAmount,
      person: draft.person,
      status: draft.status,
      due_day: diaLimite ?? null,
      dia_limite_mes: diaLimite ?? null,
      dias_anticipacion_alerta: draft.dias_anticipacion_alerta ?? null,
      notes: draft.notes ?? null,
    };

    try {
      let { error } = await this.supabase.client
        .from('fixed_expenses')
        .update(payload)
        .eq('id', id);

      // Fallback defensivo si la base de datos aún no tiene las nuevas columnas
      if (error && error.message.includes('schema cache')) {
        const fallbackPayload: Record<string, unknown> = { ...payload };
        delete fallbackPayload['dia_limite_mes'];
        delete fallbackPayload['dias_anticipacion_alerta'];
        const retry = await this.supabase.client
          .from('fixed_expenses')
          .update(fallbackPayload)
          .eq('id', id);
        error = retry.error;
      }

      if (error) {
        console.error('Error actualizando gasto fijo en Supabase:', error.message);
        this.toastService.show(`Error al sincronizar con BD: ${error.message}`, { type: 'error' });
        return;
      }
    } catch (err) {
      console.error('Error de red al actualizar gasto fijo:', err);
    }

    this.toastService.show('Gasto fijo actualizado', { type: 'success' });
  }

  async deleteFixedExpense(id: string): Promise<void> {
    this.lastLocalMutationTime = Date.now();
    const fixed = this.fixedExpensesSignal().find((f) => f.id === id);
    if (!fixed) return;

    this.fixedExpensesSignal.update((list) => {
      const updated = list.filter((f) => f.id !== id);
      this.saveToStorage(updated);
      return updated;
    });

    try {
      const { error } = await this.supabase.client.from('fixed_expenses').delete().eq('id', id);
      if (error) {
        console.error('Error eliminando gasto fijo en Supabase:', error.message);
        this.toastService.show(`Eliminado localmente. (BD: ${error.message})`, { type: 'warning' });
      } else {
        this.toastService.show(`Gasto fijo "${fixed.name}" eliminado`, { type: 'success' });
      }
    } catch (err) {
      console.error('Error de red al eliminar gasto fijo:', err);
    }
  }

  setMonth(month: number): void {
    this.selectedMonth.set(month);
  }

  setYear(year: number): void {
    this.selectedYear.set(year);
  }

  setPerson(person: ExpensePerson | 'Todos'): void {
    this.selectedPerson.set(person);
  }

  // ==========================================
  // STORAGE & REALTIME
  // ==========================================

  private loadFromStorage(): FixedExpense[] {
    try {
      const stored = localStorage.getItem(STORAGE_FIXED_EXPENSES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Error leyendo gastos fijos de localStorage:', e);
    }
    return [];
  }

  private saveToStorage(items: FixedExpense[]): void {
    try {
      localStorage.setItem(STORAGE_FIXED_EXPENSES_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Error guardando gastos fijos en localStorage:', e);
    }
  }

  private setupRealtime(): void {
    try {
      this.supabase.client
        .channel('public:fixed_expenses')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'fixed_expenses' },
          () => {
            if (Date.now() - this.lastLocalMutationTime < 3000) return;
            this.loadFixedExpenses();
          },
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription no disponible para fixed_expenses:', err);
    }
  }
}
