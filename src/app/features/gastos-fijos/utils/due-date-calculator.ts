import {
  GastoFijoAlerta,
  ResultadoCalculoVencimiento,
} from '../data/fixed-expense.model';

/**
 * Stub de la función pura de cálculo de vencimiento para TDD (Fase 2.B).
 * La implementación completa se realizará en la Tarea 2.4.
 *
 * @param gasto Entidad inmutable de gasto fijo para evaluación.
 * @param _fechaReferencia Fecha base de evaluación (Date o string ISO 'YYYY-MM-DD').
 * @returns Contrato estructurado de resultado.
 */
export function calcularVencimientoGastoFijo(
  gasto: Readonly<GastoFijoAlerta>,
  _fechaReferencia: Date | string
): ResultadoCalculoVencimiento {
  return {
    gastoId: gasto.id,
    diasRestantes: 0,
    fechaLimiteCalculada: '',
    estado: 'al_dia',
    requiereNotificacion: false,
  };
}
