import { inject, Injectable } from '@angular/core';
import { NOTIFICATION_PROVIDER, type NotificationPayload, type NotificationResult } from '../../../core/notifications/notification-provider.interface';
import { FixedExpensesService } from './fixed-expenses.service';
import type { AlertaGastoEvaluada, FixedExpense, GastoFijoAlerta, ResultadoCalculoVencimiento, ResultadoDespachoAlertas } from './fixed-expense.model';
import { calcularVencimientoGastoFijo } from '../utils/due-date-calculator';

export interface EvaluacionAlertasOptions {
  readonly fechaReferencia?: Date | string;
  readonly idsGastosPagados?: readonly string[] | Set<string>;
}

function toGastoFijoAlerta(g: FixedExpense): GastoFijoAlerta {
  return {
    id: g.id,
    nombre: g.name,
    monto: g.expectedAmount,
    dia_limite_mes: g.dia_limite_mes ?? g.dueDay ?? 1,
    dias_anticipacion_alerta: g.dias_anticipacion_alerta ?? 3,
  };
}

@Injectable({ providedIn: 'root' })
export class FixedExpenseAlertsService {
  private readonly notificationProvider = inject(NOTIFICATION_PROVIDER, { optional: true });
  private readonly fixedExpensesService = inject(FixedExpensesService);

  construirPayloadAlerta(gasto: GastoFijoAlerta, resultado: ResultadoCalculoVencimiento): NotificationPayload {
    const isHoy = resultado.estado === 'vence_hoy';
    const isVencido = resultado.estado === 'vencido';
    const titlePrefix = isHoy ? 'Gasto vence hoy' : isVencido ? 'Gasto vencido' : 'Gasto próximo a vencer';
    const body = isHoy
      ? `El gasto ${gasto.nombre} vence hoy`
      : isVencido
        ? `El gasto ${gasto.nombre} venció`
        : `El gasto ${gasto.nombre} vence en ${resultado.diasRestantes} días`;

    return {
      title: `${titlePrefix}: ${gasto.nombre}`,
      body,
      tag: `gasto-fijo-${gasto.id}`,
      priority: isHoy || isVencido ? 'high' : 'normal',
      data: { gastoId: gasto.id, estado: resultado.estado, diasRestantes: resultado.diasRestantes },
    };
  }

  generarPayloadNotificacion(gasto: FixedExpense, calculo: ResultadoCalculoVencimiento): NotificationPayload | undefined {
    return calculo.requiereNotificacion ? this.construirPayloadAlerta(toGastoFijoAlerta(gasto), calculo) : undefined;
  }

  evaluarAlertas(
    gastos?: readonly FixedExpense[],
    opcionesOFecha?: EvaluacionAlertasOptions | Date | string,
    idsGastosPagadosFallback?: readonly string[] | Set<string>
  ): readonly AlertaGastoEvaluada[] {
    if (!gastos || gastos.length === 0) return [];

    const isOptObj = opcionesOFecha && typeof opcionesOFecha === 'object' && !(opcionesOFecha instanceof Date);
    const fecha = (isOptObj ? opcionesOFecha.fechaReferencia : opcionesOFecha) ?? new Date();
    const rawPagados = idsGastosPagadosFallback ?? (isOptObj ? opcionesOFecha.idsGastosPagados : undefined);
    const idsPagados = new Set(rawPagados ?? []);

    return gastos
      .filter((g) => g.status === 'activo' && !idsPagados.has(g.id))
      .map((gasto) => {
        const calculo = calcularVencimientoGastoFijo(toGastoFijoAlerta(gasto), fecha);
        return {
          gasto,
          calculo,
          requiereNotificacion: calculo.requiereNotificacion,
          payload: this.generarPayloadNotificacion(gasto, calculo),
        };
      });
  }

  evaluarGastos(
    gastos: readonly FixedExpense[],
    fechaReferencia: Date | string = new Date(),
    idsGastosPagados?: readonly string[] | Set<string>
  ): readonly AlertaGastoEvaluada[] {
    return this.evaluarAlertas(gastos, { fechaReferencia, idsGastosPagados }).filter((a) => a.requiereNotificacion);
  }

  async despacharAlertas(
    alertasORecipient?: readonly AlertaGastoEvaluada[] | string,
    recipientOAlertas?: readonly AlertaGastoEvaluada[] | string
  ): Promise<ResultadoDespachoAlertas> {
    const isFirstArr = Array.isArray(alertasORecipient);
    const alertas = (isFirstArr ? alertasORecipient : Array.isArray(recipientOAlertas) ? recipientOAlertas : []) as readonly AlertaGastoEvaluada[];
    const recipientId = typeof alertasORecipient === 'string' ? alertasORecipient : (typeof recipientOAlertas === 'string' ? recipientOAlertas : 'all');
    const totalEvaluadas = alertas.length;

    if (!this.notificationProvider || !(await this.notificationProvider.isSupported())) {
      return { totalEvaluadas, enviadas: 0, fallidas: 0, omitidas: totalEvaluadas, detalles: [] };
    }

    const notificables = alertas.filter((a) => a.requiereNotificacion && a.payload);
    const omitidas = totalEvaluadas - notificables.length;
    const resultados = await Promise.allSettled(
      notificables.map((a) => this.notificationProvider!.sendNotification(recipientId, a.payload!))
    );

    let enviadas = 0;
    let fallidas = 0;
    const detalles: NotificationResult[] = [];

    for (const res of resultados) {
      if (res.status === 'fulfilled') {
        detalles.push(res.value);
        if (res.value.success) enviadas++; else fallidas++;
      } else {
        fallidas++;
        detalles.push({
          success: false,
          error: res.reason instanceof Error ? res.reason.message : String(res.reason),
          timestamp: new Date().toISOString(),
        });
      }
    }

    return { totalEvaluadas, enviadas, fallidas, omitidas, detalles };
  }

  async evaluarYDespacharAlertas(
    recipientId: string = 'all',
    fechaReferencia: Date | string = new Date()
  ): Promise<ResultadoDespachoAlertas> {
    const gastos = this.fixedExpensesService.activeFixedExpenses();
    const idsPagados = new Set(
      this.fixedExpensesService.monthlyStatuses().filter((s) => s.isPaid).map((s) => s.fixedExpense.id)
    );
    const alertas = this.evaluarAlertas(gastos, { fechaReferencia, idsGastosPagados: idsPagados });
    return this.despacharAlertas(alertas, recipientId);
  }
}
