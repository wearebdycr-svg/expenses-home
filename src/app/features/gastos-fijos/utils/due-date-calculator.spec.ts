import { describe, it, expect } from 'vitest';
import {
  GastoFijoAlerta,
} from '../data/fixed-expense.model';
import { calcularVencimientoGastoFijo } from './due-date-calculator';

describe('calcularVencimientoGastoFijo - Motor Puro de Vencimientos', () => {
  const mockGastoBase: GastoFijoAlerta = {
    id: 'gf-101',
    nombre: 'Servicio de Internet',
    monto: 85_000,
    dia_limite_mes: 15,
    dias_anticipacion_alerta: 3,
  };

  describe('1. Regla de Clamping para Fin de Mes (Meses Cortos y Bisiestos)', () => {
    it('ajusta dia_limite_mes = 31 al 28 de febrero en un año no bisiesto', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 31,
      };
      const result = calcularVencimientoGastoFijo(gasto, '2025-02-10');

      expect(result.fechaLimiteCalculada).toBe('2025-02-28');
      expect(result.diasRestantes).toBe(18);
    });

    it('ajusta dia_limite_mes = 31 al 29 de febrero en un año bisiesto', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 31,
      };
      const result = calcularVencimientoGastoFijo(gasto, '2024-02-10');

      expect(result.fechaLimiteCalculada).toBe('2024-02-29');
      expect(result.diasRestantes).toBe(19);
    });

    it('ajusta dia_limite_mes = 30 al 28 de febrero en año no bisiesto', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 30,
      };
      const result = calcularVencimientoGastoFijo(gasto, '2026-02-01');

      expect(result.fechaLimiteCalculada).toBe('2026-02-28');
      expect(result.diasRestantes).toBe(27);
    });

    it('ajusta dia_limite_mes = 31 al día 30 en meses de 30 días (abril, junio, septiembre, noviembre)', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 31,
      };

      // Abril
      const resAbril = calcularVencimientoGastoFijo(gasto, '2026-04-10');
      expect(resAbril.fechaLimiteCalculada).toBe('2026-04-30');
      expect(resAbril.diasRestantes).toBe(20);

      // Junio
      const resJunio = calcularVencimientoGastoFijo(gasto, '2026-06-01');
      expect(resJunio.fechaLimiteCalculada).toBe('2026-06-30');
      expect(resJunio.diasRestantes).toBe(29);

      // Septiembre
      const resSept = calcularVencimientoGastoFijo(gasto, '2026-09-15');
      expect(resSept.fechaLimiteCalculada).toBe('2026-09-30');
      expect(resSept.diasRestantes).toBe(15);

      // Noviembre
      const resNov = calcularVencimientoGastoFijo(gasto, '2026-11-01');
      expect(resNov.fechaLimiteCalculada).toBe('2026-11-30');
      expect(resNov.diasRestantes).toBe(29);
    });

    it('mantiene dia_limite_mes = 15 intacto en meses de 31 o 30 días', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 15,
      };
      const result = calcularVencimientoGastoFijo(gasto, '2026-03-01');

      expect(result.fechaLimiteCalculada).toBe('2026-03-15');
      expect(result.diasRestantes).toBe(14);
    });
  });

  describe('2. Invariancia Horaria (Timezone/DST Agnóstica)', () => {
    it('produce idénticos diasRestantes a las 00:00:01, 12:00:00 y 23:59:59 del mismo día', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 20,
        dias_anticipacion_alerta: 5,
      };

      const dateInicio = new Date('2026-11-10T00:00:01');
      const dateMediodia = new Date('2026-11-10T12:00:00');
      const dateFin = new Date('2026-11-10T23:59:59');

      const resInicio = calcularVencimientoGastoFijo(gasto, dateInicio);
      const resMediodia = calcularVencimientoGastoFijo(gasto, dateMediodia);
      const resFin = calcularVencimientoGastoFijo(gasto, dateFin);

      expect(resInicio.diasRestantes).toBe(10);
      expect(resMediodia.diasRestantes).toBe(10);
      expect(resFin.diasRestantes).toBe(10);

      expect(resInicio.fechaLimiteCalculada).toBe('2026-11-20');
      expect(resMediodia.fechaLimiteCalculada).toBe('2026-11-20');
      expect(resFin.fechaLimiteCalculada).toBe('2026-11-20');

      expect(resInicio.estado).toBe(resMediodia.estado);
      expect(resMediodia.estado).toBe(resFin.estado);
      expect(resInicio.requiereNotificacion).toBe(resMediodia.requiereNotificacion);
    });

    it('soporta entrada tipo string ISO YYYY-MM-DD y Date object equivalentemente', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 10,
      };

      const resString = calcularVencimientoGastoFijo(gasto, '2026-05-02');
      const resDate = calcularVencimientoGastoFijo(gasto, new Date('2026-05-02T15:30:00'));

      expect(resString.diasRestantes).toBe(resDate.diasRestantes);
      expect(resString.fechaLimiteCalculada).toBe(resDate.fechaLimiteCalculada);
      expect(resString.estado).toBe(resDate.estado);
      expect(resString.requiereNotificacion).toBe(resDate.requiereNotificacion);
    });
  });

  describe('3. Cambio de Ciclo y Año Calendario', () => {
    it('evalúa correctamente vencimiento del mes actual cuando la fecha es a fin de mes', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 31,
        dias_anticipacion_alerta: 3,
      };

      const resDecember = calcularVencimientoGastoFijo(gasto, '2026-12-30');
      expect(resDecember.fechaLimiteCalculada).toBe('2026-12-31');
      expect(resDecember.diasRestantes).toBe(1);
      expect(resDecember.estado).toBe('proximo');
      expect(resDecember.requiereNotificacion).toBe(true);
    });

    it('evalúa vencimiento en enero desde el primer día del año', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 5,
        dias_anticipacion_alerta: 3,
      };

      const resJan = calcularVencimientoGastoFijo(gasto, '2027-01-01');
      expect(resJan.fechaLimiteCalculada).toBe('2027-01-05');
      expect(resJan.diasRestantes).toBe(4);
      expect(resJan.estado).toBe('al_dia');
      expect(resJan.requiereNotificacion).toBe(false);
    });
  });

  describe('4. Unión de Estados (EstadoVencimiento) y Flag requiereNotificacion', () => {
    it('asigna estado "al_dia" y requiereNotificacion=false cuando diasRestantes > dias_anticipacion_alerta', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 20,
        dias_anticipacion_alerta: 3,
      };

      const result = calcularVencimientoGastoFijo(gasto, '2026-11-10'); // diasRestantes = 10 > 3
      expect(result.diasRestantes).toBe(10);
      expect(result.estado).toBe('al_dia');
      expect(result.requiereNotificacion).toBe(false);
    });

    it('asigna estado "proximo" y requiereNotificacion=true cuando 1 <= diasRestantes <= dias_anticipacion_alerta', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 15,
        dias_anticipacion_alerta: 3,
      };

      const resMaxAlerta = calcularVencimientoGastoFijo(gasto, '2026-11-12'); // diasRestantes = 3
      expect(resMaxAlerta.diasRestantes).toBe(3);
      expect(resMaxAlerta.estado).toBe('proximo');
      expect(resMaxAlerta.requiereNotificacion).toBe(true);

      const resMinAlerta = calcularVencimientoGastoFijo(gasto, '2026-11-14'); // diasRestantes = 1
      expect(resMinAlerta.diasRestantes).toBe(1);
      expect(resMinAlerta.estado).toBe('proximo');
      expect(resMinAlerta.requiereNotificacion).toBe(true);
    });

    it('asigna estado "vence_hoy" y requiereNotificacion=true cuando diasRestantes === 0', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 15,
        dias_anticipacion_alerta: 3,
      };

      const result = calcularVencimientoGastoFijo(gasto, '2026-11-15'); // diasRestantes = 0
      expect(result.diasRestantes).toBe(0);
      expect(result.fechaLimiteCalculada).toBe('2026-11-15');
      expect(result.estado).toBe('vence_hoy');
      expect(result.requiereNotificacion).toBe(true);
    });

    it('asigna estado "vencido" y requiereNotificacion=true cuando diasRestantes < 0', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 15,
        dias_anticipacion_alerta: 3,
      };

      const result = calcularVencimientoGastoFijo(gasto, '2026-11-18'); // diasRestantes = -3
      expect(result.diasRestantes).toBe(-3);
      expect(result.fechaLimiteCalculada).toBe('2026-11-15');
      expect(result.estado).toBe('vencido');
      expect(result.requiereNotificacion).toBe(true);
    });
  });

  describe('5. Inmutabilidad Estricta', () => {
    it('no muta el objeto GastoFijoAlerta ni sus propiedades de entrada', () => {
      const gastoOriginal: GastoFijoAlerta = Object.freeze({
        id: 'gf-frozen-99',
        nombre: 'Suscripción Netflix',
        monto: 45_000,
        dia_limite_mes: 25,
        dias_anticipacion_alerta: 2,
      });

      const result = calcularVencimientoGastoFijo(gastoOriginal, '2026-11-20');

      expect(gastoOriginal.id).toBe('gf-frozen-99');
      expect(gastoOriginal.nombre).toBe('Suscripción Netflix');
      expect(gastoOriginal.monto).toBe(45_000);
      expect(gastoOriginal.dia_limite_mes).toBe(25);
      expect(gastoOriginal.dias_anticipacion_alerta).toBe(2);

      expect(result.gastoId).toBe('gf-frozen-99');
      expect(result.diasRestantes).toBe(5);
      expect(result.estado).toBe('al_dia');
      expect(result.requiereNotificacion).toBe(false);
    });

    it('retorna un resultado inmutable (Object.isFrozen)', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 20,
      };
      const result = calcularVencimientoGastoFijo(gasto, '2026-11-10');

      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('6. Casos de Borde: Siglos Bisiestos y Formatos Alternativos de Fecha', () => {
    it('reconoce año bisiesto secular múltiplo de 400 (ej. año 2000)', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 31,
      };
      const result = calcularVencimientoGastoFijo(gasto, '2000-02-10');

      expect(result.fechaLimiteCalculada).toBe('2000-02-29');
      expect(result.diasRestantes).toBe(19);
    });

    it('reconoce año no bisiesto secular múltiplo de 100 pero no de 400 (ej. año 1900)', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 31,
      };
      const result = calcularVencimientoGastoFijo(gasto, '1900-02-10');

      expect(result.fechaLimiteCalculada).toBe('1900-02-28');
      expect(result.diasRestantes).toBe(18);
    });

    it('soporta entrada tipo string en formato alternativo no ISO directo', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 15,
      };
      const result = calcularVencimientoGastoFijo(gasto, '2026/11/10');

      expect(result.fechaLimiteCalculada).toBe('2026-11-15');
      expect(result.diasRestantes).toBe(5);
    });

    it('gestiona correctamente dias_anticipacion_alerta = 0', () => {
      const gasto: GastoFijoAlerta = {
        ...mockGastoBase,
        dia_limite_mes: 15,
        dias_anticipacion_alerta: 0,
      };

      const resAlDia = calcularVencimientoGastoFijo(gasto, '2026-11-14'); // diasRestantes = 1 > 0
      expect(resAlDia.diasRestantes).toBe(1);
      expect(resAlDia.estado).toBe('al_dia');
      expect(resAlDia.requiereNotificacion).toBe(false);

      const resVenceHoy = calcularVencimientoGastoFijo(gasto, '2026-11-15'); // diasRestantes = 0
      expect(resVenceHoy.diasRestantes).toBe(0);
      expect(resVenceHoy.estado).toBe('vence_hoy');
      expect(resVenceHoy.requiereNotificacion).toBe(true);
    });
  });
});
