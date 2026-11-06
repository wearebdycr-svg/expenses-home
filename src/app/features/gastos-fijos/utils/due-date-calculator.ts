import {
  GastoFijoAlerta,
  EstadoVencimiento,
  ResultadoCalculoVencimiento,
} from '../data/fixed-expense.model';

const MS_POR_DIA = 86_400_000;

/**
 * Determina si un año calendario es bisiesto bajo el calendario gregoriano.
 */
function esBisiesto(año: number): boolean {
  return (año % 4 === 0 && año % 100 !== 0) || año % 400 === 0;
}

/**
 * Retorna la cantidad exacta de días para un mes y año específicos.
 *
 * @param año Año calendario de 4 dígitos.
 * @param mes Mes calendario (1 = Enero, 12 = Diciembre).
 */
function obtenerDiasDelMes(año: number, mes: number): number {
  switch (mes) {
    case 2:
      return esBisiesto(año) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

/**
 * Extrae los componentes de fecha civil (año, mes 1..12, día 1..31) de forma
 * segura y desacoplada de husos horarios.
 */
function extraerFechaCivil(fechaReferencia: Date | string): {
  año: number;
  mes: number;
  dia: number;
} {
  if (typeof fechaReferencia === 'string') {
    const match = fechaReferencia.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        año: Number.parseInt(match[1], 10),
        mes: Number.parseInt(match[2], 10),
        dia: Number.parseInt(match[3], 10),
      };
    }

    const parsed = new Date(fechaReferencia);
    return {
      año: parsed.getFullYear(),
      mes: parsed.getMonth() + 1,
      dia: parsed.getDate(),
    };
  }

  return {
    año: fechaReferencia.getFullYear(),
    mes: fechaReferencia.getMonth() + 1,
    dia: fechaReferencia.getDate(),
  };
}

/**
 * Calcula el estado de vencimiento de un gasto fijo de forma pura y determinista.
 *
 * @param gasto Entidad inmutable de gasto fijo para evaluación.
 * @param fechaReferencia Fecha base de evaluación (Date o string ISO 'YYYY-MM-DD').
 * @returns Contrato inmutable estructurado con días restantes, fecha límite y flag de notificación.
 */
export function calcularVencimientoGastoFijo(
  gasto: Readonly<GastoFijoAlerta>,
  fechaReferencia: Date | string
): ResultadoCalculoVencimiento {
  const { año, mes, dia: refDia } = extraerFechaCivil(fechaReferencia);

  const diasEnMes = obtenerDiasDelMes(año, mes);
  const diaEfectivo = Math.min(gasto.dia_limite_mes, diasEnMes);

  const mesStr = String(mes).padStart(2, '0');
  const diaStr = String(diaEfectivo).padStart(2, '0');
  const fechaLimiteCalculada = `${año}-${mesStr}-${diaStr}`;

  // Normalización temporal canónica UTC a mediodía (12:00:00Z)
  const timestampLimiteUtc = Date.UTC(año, mes - 1, diaEfectivo, 12, 0, 0);
  const timestampRefUtc = Date.UTC(año, mes - 1, refDia, 12, 0, 0);
  const diasRestantes = Math.round((timestampLimiteUtc - timestampRefUtc) / MS_POR_DIA);

  let estado: EstadoVencimiento;
  let requiereNotificacion: boolean;

  if (diasRestantes > gasto.dias_anticipacion_alerta) {
    estado = 'al_dia';
    requiereNotificacion = false;
  } else if (diasRestantes >= 1) {
    estado = 'proximo';
    requiereNotificacion = true;
  } else if (diasRestantes === 0) {
    estado = 'vence_hoy';
    requiereNotificacion = true;
  } else {
    estado = 'vencido';
    requiereNotificacion = true;
  }

  return Object.freeze({
    gastoId: gasto.id,
    diasRestantes,
    fechaLimiteCalculada,
    estado,
    requiereNotificacion,
  });
}
