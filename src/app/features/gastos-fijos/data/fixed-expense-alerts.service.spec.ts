import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  NOTIFICATION_PROVIDER,
  type NotificationPayload,
  type NotificationProvider,
  type NotificationResult,
} from '../../../core/notifications/notification-provider.interface';
import { FixedExpenseAlertsService } from './fixed-expense-alerts.service';
import type {
  AlertaGastoEvaluada,
  FixedExpense,
} from './fixed-expense.model';

class MockNotificationProvider implements NotificationProvider {
  readonly providerName = 'mock-provider';
  supported = true;
  sentCalls: { recipientId: string; payload: NotificationPayload }[] = [];
  shouldFail = false;
  shouldReject = false;
  failureMessage = 'Error simulado en MockNotificationProvider';
  responsesQueue: Array<NotificationResult | Error> = [];

  isSupported(): boolean {
    return this.supported;
  }

  async sendNotification(
    recipientId: string,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    this.sentCalls.push({ recipientId, payload });

    if (this.responsesQueue.length > 0) {
      const nextResponse = this.responsesQueue.shift()!;
      if (nextResponse instanceof Error) {
        throw nextResponse;
      }
      return nextResponse;
    }

    if (this.shouldReject) {
      throw new Error(this.failureMessage);
    }

    if (this.shouldFail) {
      return {
        success: false,
        error: this.failureMessage,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      messageId: `mock-msg-${this.sentCalls.length}`,
      timestamp: new Date().toISOString(),
    };
  }

  reset(): void {
    this.sentCalls = [];
    this.supported = true;
    this.shouldFail = false;
    this.shouldReject = false;
    this.responsesQueue = [];
  }
}

describe('FixedExpenseAlertsService - Orquestador de Alertas de Gastos Fijos (Fase RED)', () => {
  let service: FixedExpenseAlertsService;
  let mockProvider: MockNotificationProvider;

  beforeEach(() => {
    mockProvider = new MockNotificationProvider();

    TestBed.configureTestingModule({
      providers: [
        FixedExpenseAlertsService,
        {
          provide: NOTIFICATION_PROVIDER,
          useValue: mockProvider,
        },
      ],
    });

    service = TestBed.inject(FixedExpenseAlertsService);
  });

  // a) Evaluar colección vacía -> retorna 0 alertas
  it('a) retorna colección vacía (0 alertas) al evaluar una lista sin gastos fijos', () => {
    const alertas = service.evaluarAlertas([], { fechaReferencia: '2026-11-06' });
    expect(alertas).toEqual([]);
    expect(alertas.length).toBe(0);
  });

  // b) Filtrar gastos inactivos -> no se incluyen en las alertas
  it('b) filtra y excluye gastos fijos con estado inactivo de la evaluación de alertas', () => {
    const gastos: FixedExpense[] = [
      {
        id: 'fe-activo',
        name: 'Internet Fibra',
        expectedAmount: 85_000,
        person: 'Compartido',
        dia_limite_mes: 8,
        dias_anticipacion_alerta: 3,
        status: 'activo',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'fe-inactivo',
        name: 'Gimnasio Cancelado',
        expectedAmount: 120_000,
        person: 'Charlie',
        dia_limite_mes: 8,
        dias_anticipacion_alerta: 3,
        status: 'inactivo',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const alertas = service.evaluarAlertas(gastos, { fechaReferencia: '2026-11-07' });

    expect(alertas.length).toBe(1);
    expect(alertas[0].gasto.id).toBe('fe-activo');
    expect(alertas.some((a) => a.gasto.id === 'fe-inactivo')).toBe(false);
  });

  // c) Omitir gastos que ya estén pagados (presentes en idsGastosPagados)
  it('c) omite de las alertas aquellos gastos que ya figuren como pagados en idsGastosPagados', () => {
    const gastos: FixedExpense[] = [
      {
        id: 'fe-pagado',
        name: 'Arriendo',
        expectedAmount: 1_200_000,
        person: 'Compartido',
        dia_limite_mes: 10,
        dias_anticipacion_alerta: 5,
        status: 'activo',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'fe-pendiente',
        name: 'Energía EPM',
        expectedAmount: 180_000,
        person: 'Benny',
        dia_limite_mes: 10,
        dias_anticipacion_alerta: 5,
        status: 'activo',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const alertas = service.evaluarAlertas(gastos, {
      fechaReferencia: '2026-11-08',
      idsGastosPagados: ['fe-pagado'],
    });

    expect(alertas.length).toBe(1);
    expect(alertas[0].gasto.id).toBe('fe-pendiente');
    expect(alertas.some((a) => a.gasto.id === 'fe-pagado')).toBe(false);
  });

  // d) Reconocer dia_limite_mes o fallback retrocompatible a dueDay
  it('d) reconoce tanto dia_limite_mes canónico como fallback retrocompatible dueDay', () => {
    const gastoModerno: FixedExpense = {
      id: 'fe-moderno',
      name: 'Telefonía Móvil',
      expectedAmount: 45_000,
      person: 'Charlie',
      dia_limite_mes: 15,
      dias_anticipacion_alerta: 3,
      status: 'activo',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const gastoLegacy: FixedExpense = {
      id: 'fe-legacy',
      name: 'Streaming',
      expectedAmount: 30_000,
      person: 'Benny',
      dueDay: 15, // fallback retrocompatible
      dias_anticipacion_alerta: 3,
      status: 'activo',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const alertas = service.evaluarAlertas([gastoModerno, gastoLegacy], {
      fechaReferencia: '2026-11-10',
    });

    expect(alertas.length).toBe(2);
    const alertaModerno = alertas.find((a) => a.gasto.id === 'fe-moderno')!;
    const alertaLegacy = alertas.find((a) => a.gasto.id === 'fe-legacy')!;

    expect(alertaModerno.calculo.fechaLimiteCalculada).toBe('2026-11-15');
    expect(alertaModerno.calculo.diasRestantes).toBe(5);

    expect(alertaLegacy.calculo.fechaLimiteCalculada).toBe('2026-11-15');
    expect(alertaLegacy.calculo.diasRestantes).toBe(5);
  });

  // e) Gastos en estado 'al_dia' -> no generan payload notificable (requiereNotificacion: false)
  it('e) marca gastos en estado al_dia con requiereNotificacion=false y sin payload notificable', () => {
    const gastoAlDia: FixedExpense = {
      id: 'fe-aldia',
      name: 'Seguro Médico',
      expectedAmount: 250_000,
      person: 'Compartido',
      dia_limite_mes: 25,
      dias_anticipacion_alerta: 3,
      status: 'activo',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const alertas = service.evaluarAlertas([gastoAlDia], {
      fechaReferencia: '2026-11-05',
    });

    expect(alertas.length).toBe(1);
    const alerta = alertas[0];
    expect(alerta.calculo.estado).toBe('al_dia');
    expect(alerta.requiereNotificacion).toBe(false);
    expect(alerta.calculo.requiereNotificacion).toBe(false);
    expect(alerta.payload).toBeUndefined();
  });

  // f) Gastos en 'proximo', 'vence_hoy' y 'vencido' -> generan payload con tag 'gasto-fijo-${id}', prioridad correspondiente y texto determinista
  it('f) genera payload determinista con tag gasto-fijo-${id} y prioridad correspondiente para proximo, vence_hoy y vencido', () => {
    const gastoProximo: FixedExpense = {
      id: 'fe-proximo',
      name: 'Gas Natural',
      expectedAmount: 35_000,
      person: 'Compartido',
      dia_limite_mes: 12,
      dias_anticipacion_alerta: 3,
      status: 'activo',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const gastoVenceHoy: FixedExpense = {
      id: 'fe-hoy',
      name: 'Agua Potable',
      expectedAmount: 60_000,
      person: 'Compartido',
      dia_limite_mes: 10,
      dias_anticipacion_alerta: 3,
      status: 'activo',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const gastoVencido: FixedExpense = {
      id: 'fe-vencido',
      name: 'Tarjeta Crédito Cuota',
      expectedAmount: 500_000,
      person: 'Charlie',
      dia_limite_mes: 5,
      dias_anticipacion_alerta: 3,
      status: 'activo',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const alertas = service.evaluarAlertas([gastoProximo, gastoVenceHoy, gastoVencido], {
      fechaReferencia: '2026-11-10',
    });

    expect(alertas.length).toBe(3);

    // 1. Próximo (faltan 2 días)
    const aProximo = alertas.find((a) => a.gasto.id === 'fe-proximo')!;
    expect(aProximo.calculo.estado).toBe('proximo');
    expect(aProximo.requiereNotificacion).toBe(true);
    expect(aProximo.payload).toBeDefined();
    expect(aProximo.payload?.tag).toBe('gasto-fijo-fe-proximo');
    expect(aProximo.payload?.priority).toBe('normal');
    expect(aProximo.payload?.title).toContain('Gas Natural');
    expect(aProximo.payload?.body).toBeDefined();

    // 2. Vence Hoy (0 días)
    const aHoy = alertas.find((a) => a.gasto.id === 'fe-hoy')!;
    expect(aHoy.calculo.estado).toBe('vence_hoy');
    expect(aHoy.requiereNotificacion).toBe(true);
    expect(aHoy.payload).toBeDefined();
    expect(aHoy.payload?.tag).toBe('gasto-fijo-fe-hoy');
    expect(aHoy.payload?.priority).toBe('high');
    expect(aHoy.payload?.title).toContain('Agua Potable');
    expect(aHoy.payload?.body).toBeDefined();

    // 3. Vencido (-5 días)
    const aVencido = alertas.find((a) => a.gasto.id === 'fe-vencido')!;
    expect(aVencido.calculo.estado).toBe('vencido');
    expect(aVencido.requiereNotificacion).toBe(true);
    expect(aVencido.payload).toBeDefined();
    expect(aVencido.payload?.tag).toBe('gasto-fijo-fe-vencido');
    expect(aVencido.payload?.priority).toBe('high');
    expect(aVencido.payload?.title).toContain('Tarjeta Crédito Cuota');
    expect(aVencido.payload?.body).toBeDefined();
  });

  // g) Despacho: cuando el canal no está soportado (isSupported() === false), aborta sin fallar y marca 0 enviadas
  it('g) cuando el canal de notificaciones no está soportado (isSupported === false), aborta sin fallar y reporta 0 enviadas', async () => {
    mockProvider.supported = false;

    const alertasMock: AlertaGastoEvaluada[] = [
      {
        gasto: {
          id: 'fe-1',
          name: 'Internet',
          expectedAmount: 80_000,
          person: 'Compartido',
          dia_limite_mes: 10,
          status: 'activo',
          createdAt: '2026-01-01T00:00:00Z',
        },
        calculo: {
          gastoId: 'fe-1',
          diasRestantes: 0,
          fechaLimiteCalculada: '2026-11-10',
          estado: 'vence_hoy',
          requiereNotificacion: true,
        },
        requiereNotificacion: true,
        payload: {
          title: 'Gasto vence hoy: Internet',
          body: 'El gasto vence hoy',
          tag: 'gasto-fijo-fe-1',
          priority: 'high',
        },
      },
    ];

    const resultado = await service.despacharAlertas(alertasMock);

    expect(resultado.totalEvaluadas).toBe(1);
    expect(resultado.enviadas).toBe(0);
    expect(resultado.fallidas).toBe(0);
    expect(resultado.omitidas).toBe(1);
    expect(mockProvider.sentCalls.length).toBe(0);
  });

  // h) Despacho exitoso de múltiples alertas -> llama a sendNotification con cada payload y consolida el resultado
  it('h) despacha exitosamente múltiples alertas llamando a sendNotification por cada payload notificable y consolida el resultado', async () => {
    const alerta1: AlertaGastoEvaluada = {
      gasto: {
        id: 'fe-1',
        name: 'Internet',
        expectedAmount: 80_000,
        person: 'Compartido',
        dia_limite_mes: 10,
        status: 'activo',
        createdAt: '2026-01-01T00:00:00Z',
      },
      calculo: {
        gastoId: 'fe-1',
        diasRestantes: 0,
        fechaLimiteCalculada: '2026-11-10',
        estado: 'vence_hoy',
        requiereNotificacion: true,
      },
      requiereNotificacion: true,
      payload: {
        title: 'Gasto vence hoy: Internet',
        body: 'El gasto Internet vence hoy',
        tag: 'gasto-fijo-fe-1',
        priority: 'high',
      },
    };

    const alerta2: AlertaGastoEvaluada = {
      gasto: {
        id: 'fe-2',
        name: 'Energía',
        expectedAmount: 150_000,
        person: 'Compartido',
        dia_limite_mes: 12,
        status: 'activo',
        createdAt: '2026-01-01T00:00:00Z',
      },
      calculo: {
        gastoId: 'fe-2',
        diasRestantes: 2,
        fechaLimiteCalculada: '2026-11-12',
        estado: 'proximo',
        requiereNotificacion: true,
      },
      requiereNotificacion: true,
      payload: {
        title: 'Gasto próximo a vencer: Energía',
        body: 'El gasto Energía vence en 2 días',
        tag: 'gasto-fijo-fe-2',
        priority: 'normal',
      },
    };

    const alertaOmitida: AlertaGastoEvaluada = {
      gasto: {
        id: 'fe-3',
        name: 'Seguro',
        expectedAmount: 200_000,
        person: 'Compartido',
        dia_limite_mes: 28,
        status: 'activo',
        createdAt: '2026-01-01T00:00:00Z',
      },
      calculo: {
        gastoId: 'fe-3',
        diasRestantes: 18,
        fechaLimiteCalculada: '2026-11-28',
        estado: 'al_dia',
        requiereNotificacion: false,
      },
      requiereNotificacion: false,
      payload: undefined,
    };

    const resultado = await service.despacharAlertas([alerta1, alerta2, alertaOmitida]);

    expect(mockProvider.sentCalls.length).toBe(2);
    expect(mockProvider.sentCalls[0].payload.tag).toBe('gasto-fijo-fe-1');
    expect(mockProvider.sentCalls[1].payload.tag).toBe('gasto-fijo-fe-2');

    expect(resultado.totalEvaluadas).toBe(3);
    expect(resultado.enviadas).toBe(2);
    expect(resultado.fallidas).toBe(0);
    expect(resultado.omitidas).toBe(1);
  });

  // i) Tolerancia a fallos: cuando sendNotification devuelve { success: false } o rechaza con error, no interrumpe el ciclo y suma en fallidas
  it('i) maneja fallos tolerando respuestas { success: false } o excepciones rechazadas sin romper el ciclo sumando en fallidas', async () => {
    const alertaExito: AlertaGastoEvaluada = {
      gasto: {
        id: 'fe-ok',
        name: 'Internet Fibra',
        expectedAmount: 80_000,
        person: 'Compartido',
        dia_limite_mes: 10,
        status: 'activo',
        createdAt: '2026-01-01T00:00:00Z',
      },
      calculo: {
        gastoId: 'fe-ok',
        diasRestantes: 0,
        fechaLimiteCalculada: '2026-11-10',
        estado: 'vence_hoy',
        requiereNotificacion: true,
      },
      requiereNotificacion: true,
      payload: {
        title: 'Alerta Internet',
        body: 'Vence hoy',
        tag: 'gasto-fijo-fe-ok',
      },
    };

    const alertaErrorLogico: AlertaGastoEvaluada = {
      gasto: {
        id: 'fe-err-logico',
        name: 'Telefonía',
        expectedAmount: 40_000,
        person: 'Charlie',
        dia_limite_mes: 10,
        status: 'activo',
        createdAt: '2026-01-01T00:00:00Z',
      },
      calculo: {
        gastoId: 'fe-err-logico',
        diasRestantes: 0,
        fechaLimiteCalculada: '2026-11-10',
        estado: 'vence_hoy',
        requiereNotificacion: true,
      },
      requiereNotificacion: true,
      payload: {
        title: 'Alerta Telefonía',
        body: 'Vence hoy',
        tag: 'gasto-fijo-fe-err-logico',
      },
    };

    const alertaExcepcion: AlertaGastoEvaluada = {
      gasto: {
        id: 'fe-err-excepcion',
        name: 'Gas',
        expectedAmount: 30_000,
        person: 'Benny',
        dia_limite_mes: 10,
        status: 'activo',
        createdAt: '2026-01-01T00:00:00Z',
      },
      calculo: {
        gastoId: 'fe-err-excepcion',
        diasRestantes: 0,
        fechaLimiteCalculada: '2026-11-10',
        estado: 'vence_hoy',
        requiereNotificacion: true,
      },
      requiereNotificacion: true,
      payload: {
        title: 'Alerta Gas',
        body: 'Vence hoy',
        tag: 'gasto-fijo-fe-err-excepcion',
      },
    };

    mockProvider.responsesQueue = [
      { success: true, messageId: 'msg-1', timestamp: new Date().toISOString() },
      { success: false, error: 'Token no registrado', timestamp: new Date().toISOString() },
      new Error('Network connection aborted'),
    ];

    const resultado = await service.despacharAlertas([
      alertaExito,
      alertaErrorLogico,
      alertaExcepcion,
    ]);

    expect(mockProvider.sentCalls.length).toBe(3);
    expect(resultado.totalEvaluadas).toBe(3);
    expect(resultado.enviadas).toBe(1);
    expect(resultado.fallidas).toBe(2);
    expect(resultado.omitidas).toBe(0);
  });
});
