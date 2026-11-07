import type { ExpensePerson } from '../../gastos/data/expense.model';
import type {
  NotificationPayload,
  NotificationResult,
} from '../../../core/notifications/notification-provider.interface';

export type FixedExpenseStatus = 'activo' | 'inactivo';

/**
 * Entidad principal de Gasto Fijo persistente en base de datos / storage local.
 */
export interface FixedExpense {
  id: string;
  name: string;
  expectedAmount: number;
  person: ExpensePerson;
  /**
   * @deprecated Utilizar `dia_limite_mes`. Mantenido temporalmente por compatibilidad regresiva con la UI existente.
   */
  dueDay?: number;
  /**
   * Día límite de pago en el mes (entero estricto entre 1 y 31 inclusive).
   */
  dia_limite_mes?: number;
  /**
   * Días de anticipación para activar la ventana de alerta (entero >= 0).
   */
  dias_anticipacion_alerta?: number;
  status: FixedExpenseStatus;
  notes?: string;
  createdAt: string;
}

export type FixedExpenseDraft = Omit<FixedExpense, 'id' | 'createdAt'>;

export interface FixedExpenseMonthlyStatus {
  fixedExpense: FixedExpense;
  isPaid: boolean;
  paidAmount: number;
  paidDate?: string;
  expenseId?: string;
  expenseDescription?: string;
  vencimiento?: ResultadoCalculoVencimiento;
}

export interface FixedExpensesSummary {
  totalFixed: number;
  totalExpectedAmount: number;
  totalPaidAmount: number;
  totalPendingAmount: number;
  paidCount: number;
  pendingCount: number;
  progressPercentage: number;
}

/* ==========================================================================
 * Wave 2: Sub-dominio de Alertas y Vencimientos de Gastos Fijos
 * ========================================================================== */

/**
 * Invariante de Dominio: Contrato inmutable de gasto fijo para evaluación
 * en el motor puro de vencimiento y despacho de notificaciones push.
 */
export interface GastoFijoAlerta {
  readonly id: string;
  readonly nombre: string;
  readonly monto: number; // Monto esperado > 0 (COP / USD)
  readonly dia_limite_mes: number; // Entero estricto entre 1 y 31 inclusive
  readonly dias_anticipacion_alerta: number; // Entero >= 0 (ventana de disparo)
}

/**
 * Estado evaluado de alerta tras el cálculo determinista de vencimiento.
 */
export type EstadoVencimiento =
  | 'al_dia' // Días restantes > dias_anticipacion_alerta
  | 'proximo' // Dentro de la ventana de anticipación [1..dias_anticipacion_alerta]
  | 'vence_hoy' // Exactamente 0 días restantes para el vencimiento
  | 'vencido'; // Días restantes < 0 en el ciclo actual

/**
 * Resultado inmutable del cálculo determinista de vencimiento.
 */
export interface ResultadoCalculoVencimiento {
  readonly gastoId: string;
  readonly diasRestantes: number;
  readonly fechaLimiteCalculada: string; // Formato canónico ISO 'YYYY-MM-DD'
  readonly estado: EstadoVencimiento;
  readonly requiereNotificacion: boolean;
}

/**
 * Alerta evaluada e inmutable resultante de confrontar un gasto fijo contra el motor
 * de vencimiento y determinar si genera un payload notificable.
 */
export interface AlertaGastoEvaluada {
  readonly gasto: FixedExpense;
  readonly calculo: ResultadoCalculoVencimiento;
  readonly requiereNotificacion: boolean;
  readonly payload?: NotificationPayload;
}

/**
 * Resumen consolidado e inmutable del proceso de despacho de alertas push.
 */
export interface ResultadoDespachoAlertas {
  readonly totalEvaluadas: number;
  readonly enviadas: number;
  readonly fallidas: number;
  readonly omitidas: number;
  readonly detalles?: readonly NotificationResult[];
}

/**
 * Type Guard estricto para validar día límite del mes (1..31).
 */
export function isValidDiaLimiteMes(day: unknown): day is number {
  return typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 31;
}

/**
 * Type Guard estricto para validar días de anticipación de alerta (>= 0).
 */
export function isValidDiasAnticipacionAlerta(days: unknown): days is number {
  return typeof days === 'number' && Number.isInteger(days) && days >= 0;
}

/**
 * Type Guard para verificar si un objeto cumple con la estructura inmutable de `GastoFijoAlerta`.
 */
export function isGastoFijoAlerta(value: unknown): value is GastoFijoAlerta {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate['id'] === 'string' &&
    candidate['id'].length > 0 &&
    typeof candidate['nombre'] === 'string' &&
    typeof candidate['monto'] === 'number' &&
    candidate['monto'] > 0 &&
    isValidDiaLimiteMes(candidate['dia_limite_mes']) &&
    isValidDiasAnticipacionAlerta(candidate['dias_anticipacion_alerta'])
  );
}

