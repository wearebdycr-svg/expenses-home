import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

/**
 * Obtiene las credenciales de la cuenta de servicio de Firebase
 * Soporta FIREBASE_SERVICE_ACCOUNT (JSON o base64) o variables separadas
 */
function getServiceAccount() {
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_ADMIN_CREDENTIALS;

  if (raw) {
    try {
      const trimmed = raw.trim();
      const jsonStr = trimmed.startsWith('{')
        ? trimmed
        : Buffer.from(trimmed, 'base64').toString('utf8');
      return JSON.parse(jsonStr);
    } catch (e) {
      console.warn('[Cron FCM] Error al parsear FIREBASE_SERVICE_ACCOUNT:', e.message);
    }
  }

  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY,
      project_id: process.env.FIREBASE_PROJECT_ID || 'expenses-home',
    };
  }

  return null;
}

/**
 * Obtiene un token de acceso OAuth2 para la API de FCM v1 usando la cuenta de servicio de Google
 */
async function getGoogleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const base64Url = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const signInput = `${base64Url(header)}.${base64Url(claimSet)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signInput);

  // Normalizar saltos de línea escapados en la llave privada
  const privateKey = serviceAccount.private_key.replace(/\\n/g, '\n');
  const signature = signer
    .sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`OAuth Google error: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

/**
 * Funciones puras para cálculo canónico de vencimiento de gastos fijos
 */
function esBisiesto(año) {
  return (año % 4 === 0 && año % 100 !== 0) || año % 400 === 0;
}

function obtenerDiasDelMes(año, mes) {
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
 * Calcula el estado de vencimiento de forma pura y canónica
 */
function calcularVencimientoCron(diaLimite, diasAnticipacion, año, mes, diaRef) {
  const diasEnMes = obtenerDiasDelMes(año, mes);
  const diaEfectivo = Math.min(diaLimite, diasEnMes);
  const mesStr = String(mes).padStart(2, '0');
  const diaStr = String(diaEfectivo).padStart(2, '0');
  const fechaLimiteCalculada = `${año}-${mesStr}-${diaStr}`;

  const timestampLimiteUtc = Date.UTC(año, mes - 1, diaEfectivo, 12, 0, 0);
  const timestampRefUtc = Date.UTC(año, mes - 1, diaRef, 12, 0, 0);
  const diasRestantes = Math.round((timestampLimiteUtc - timestampRefUtc) / 86400000);

  let estado = 'al_dia';
  let requiereNotificacion = false;

  if (diasRestantes > diasAnticipacion) {
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

  return { diaEfectivo, fechaLimiteCalculada, diasRestantes, estado, requiereNotificacion };
}

/**
 * Despacha un mensaje a una lista de tokens FCM vía FCM v1 (o fallback legacy)
 */
async function dispatchSingleNotification({
  title,
  body,
  tag,
  link,
  data,
  tokens,
  serviceAccount,
  accessToken,
  fcmServerKey,
  invalidTokensSet,
  errorDetails,
}) {
  let sentCount = 0;
  const projectId = serviceAccount?.project_id || process.env.FIREBASE_PROJECT_ID || 'expenses-home';

  if (serviceAccount && accessToken && tokens.length > 0) {
    for (const token of tokens) {
      try {
        const resp = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
                android: {
                  priority: 'high',
                  notification: {
                    title,
                    body,
                    channel_id: 'finanzas_hogar_alerts',
                    sound: 'default',
                    default_sound: true,
                    default_vibrate_timings: true,
                    notification_priority: 'PRIORITY_MAX',
                    tag: tag || undefined,
                  },
                },
                webpush: {
                  notification: {
                    title,
                    body,
                    icon: '/favicon.svg',
                    badge: '/favicon.svg',
                    tag: tag || undefined,
                  },
                  fcm_options: {
                    link: link || '/#gastos',
                  },
                },
                data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
              },
            }),
          }
        );

        if (resp.ok) {
          sentCount++;
        } else {
          const errBody = await resp.text();
          console.warn('[Cron FCM] Error enviando a token:', errBody);
          errorDetails.push(errBody);

          if (
            errBody.includes('UNREGISTERED') ||
            errBody.includes('NOT_FOUND') ||
            errBody.includes('Requested entity was not found') ||
            errBody.includes('INVALID_ARGUMENT')
          ) {
            invalidTokensSet.add(token);
          }
        }
      } catch (e) {
        console.warn('[Cron FCM] Fallo de red:', e);
        errorDetails.push(e.message);
      }
    }
  }

  // Fallback Legacy si aplica y no se pudo enviar con v1
  if (!sentCount && fcmServerKey && tokens.length > 0) {
    for (const token of tokens) {
      try {
        const resp = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify({
            to: token,
            priority: 'high',
            notification: {
              title,
              body,
              sound: 'default',
              android_channel_id: 'finanzas_hogar_alerts',
              icon: '/favicon.svg',
              tag: tag || undefined,
            },
            data: data || {},
          }),
        });
        if (resp.ok) {
          sentCount++;
        }
      } catch (e) {
        console.warn('[Cron FCM Legacy] Error enviando:', e);
      }
    }
  }

  return sentCount;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Verificación de autenticación para función crítica (CWE-306)
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    const expectedSecret = process.env.CRON_SECRET || process.env.NOTIFY_SECRET;

    let isAuthorized = false;
    if (expectedSecret && token === expectedSecret) {
      isAuthorized = true;
    } else if (token && supabaseAnonKey && token === supabaseAnonKey) {
      isAuthorized = true;
    } else if (!expectedSecret && process.env.NODE_ENV !== 'production') {
      isAuthorized = true;
    }

    if (expectedSecret && !isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized: Se requiere token de autorización para invocar el recordatorio programado' });
    }

    // 2. Obtener hora exacta en Colombia (America/Bogota, UTC-5 todo el año)
    const bogotaFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const timeParts = bogotaFormatter.formatToParts(new Date());
    const partMap = {};
    for (const p of timeParts) partMap[p.type] = p.value;

    const bogotaYear = partMap.year;
    const bogotaMonth = partMap.month;
    const bogotaDay = partMap.day;
    const bogotaHour = parseInt(partMap.hour, 10);
    const bogotaMinute = parseInt(partMap.minute, 10);
    const todayColombiaIso = `${bogotaYear}-${bogotaMonth}-${bogotaDay}`;
    const todayColombiaNum = parseInt(`${bogotaYear}${bogotaMonth}${bogotaDay}`, 10);
    const formattedColombiaTime = `${partMap.hour}:${partMap.minute}`;

    const isForce = req.query?.force === 'true' || req.query?.force === true;
    const cronType = req.query?.type || 'all'; // 'all' | 'fixed_expenses' | 'daily_reminder'

    // 3. Ventana de Seguridad Estricta para Hora Colombia:
    // El recordatorio está configurado para las 7:00 PM (19:00).
    // Para evitar notificaciones en la madrugada (por retrasos en colas de runners como GitHub Actions),
    // bloqueamos el envío fuera de la ventana permitida (18:45 a 20:15 hora Colombia), a menos que sea forzado.
    const isWithinEveningWindow =
      bogotaHour === 19 ||
      (bogotaHour === 18 && bogotaMinute >= 45) ||
      (bogotaHour === 20 && bogotaMinute <= 15);

    if (!isForce && !isWithinEveningWindow) {
      console.log(`[Cron Reminder] Omitido: La hora actual en Colombia es ${formattedColombiaTime}. Solo se permite el envío a las 7:00 PM (ventana 6:45 PM a 8:15 PM).`);
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: `Hora actual en Colombia: ${formattedColombiaTime}. El recordatorio solo se despacha a las 7:00 PM hora Colombia (ventana 6:45 PM - 8:15 PM). Omitido para evitar notificaciones nocturnas o fuera de hora.`,
        colombiaTime: formattedColombiaTime,
        colombiaDate: todayColombiaIso,
      });
    }

    // 4. Conexión a Supabase para verificaciones de deduplicación y tokens
    let tokens = [];
    let supabase = null;
    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);
    }

    // 5. Obtener los tokens FCM de los dispositivos registrados
    if (supabase) {
      const { data: dbTokens, error } = await supabase.from('fcm_tokens').select('token');
      if (!error && dbTokens) {
        tokens = dbTokens.map((t) => t.token);
      }
    }

    if (tokens.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay tokens FCM registrados para enviar recordatorios.',
        slot: 'evening_7pm',
        colombiaDate: todayColombiaIso,
      });
    }

    const MAX_CRON_TOKENS = 50;
    const targetTokens = tokens.slice(0, MAX_CRON_TOKENS);

    // Preparar autenticación FCM
    const serviceAccount = getServiceAccount();
    const fcmServerKey = process.env.FIREBASE_SERVER_KEY || process.env.FCM_SERVER_KEY;
    let accessToken = null;
    if (serviceAccount) {
      try {
        accessToken = await getGoogleAccessToken(serviceAccount);
      } catch (authErr) {
        console.warn('[Cron FCM] Error obteniendo Google Access Token:', authErr.message);
      }
    }

    const invalidTokensSet = new Set();
    const errorDetails = [];

    // =========================================================================
    // FASE 2.D / Tarea 2.7: Verificación de vencimientos de Gastos Fijos
    // =========================================================================
    const fixedExpensesReport = {
      evaluated: 0,
      notificables: 0,
      deliveredAlerts: 0,
      skipped: false,
      reason: null,
      alerts: [],
    };

    if (supabase && (cronType === 'all' || cronType === 'fixed_expenses')) {
      let alreadyRunFixedToday = false;

      // Deduplicación diaria para no repetir alertas de gastos fijos el mismo día
      if (!isForce) {
        try {
          const { data: lastFixedCron } = await supabase
            .from('category_budgets')
            .select('amount, updated_at')
            .eq('category', '__cron_fixed_expenses__')
            .maybeSingle();

          if (lastFixedCron && Number(lastFixedCron.amount) === todayColombiaNum) {
            alreadyRunFixedToday = true;
            fixedExpensesReport.skipped = true;
            fixedExpensesReport.reason = `Las alertas de gastos fijos ya fueron evaluadas y despachadas hoy (${todayColombiaIso}).`;
          }
        } catch (dedupErr) {
          console.warn('[Cron Gastos Fijos] Error consultando deduplicación:', dedupErr.message);
        }
      }

      if (!alreadyRunFixedToday || isForce) {
        try {
          // Obtener gastos fijos activos
          const { data: activeFixedExpenses, error: feErr } = await supabase
            .from('fixed_expenses')
            .select('*')
            .eq('status', 'activo');

          if (!feErr && activeFixedExpenses && activeFixedExpenses.length > 0) {
            fixedExpensesReport.evaluated = activeFixedExpenses.length;

            // Consultar gastos registrados en el mes actual en Colombia
            const numYear = parseInt(bogotaYear, 10);
            const numMonth = parseInt(bogotaMonth, 10);
            const numDay = parseInt(bogotaDay, 10);
            const startOfMonthIso = `${bogotaYear}-${bogotaMonth}-01`;
            const lastDayMonth = String(obtenerDiasDelMes(numYear, numMonth)).padStart(2, '0');
            const endOfMonthIso = `${bogotaYear}-${bogotaMonth}-${lastDayMonth}`;

            const { data: monthExpenses } = await supabase
              .from('expenses')
              .select('category, description, amount, date')
              .gte('date', startOfMonthIso)
              .lte('date', endOfMonthIso);

            const safeMonthExpenses = monthExpenses || [];

            for (const fe of activeFixedExpenses) {
              const fixedNameNorm = (fe.name || '').trim().toLowerCase();

              // Determinar si ya fue pagado este mes
              const isPaid = safeMonthExpenses.some((e) => {
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

              if (isPaid) {
                continue;
              }

              const diaLimite = Number(fe.dia_limite_mes ?? fe.due_day ?? 1);
              const diasAnticipacion = Number(fe.dias_anticipacion_alerta ?? 3);
              const calculo = calcularVencimientoCron(
                diaLimite,
                diasAnticipacion,
                numYear,
                numMonth,
                numDay
              );

              if (calculo.requiereNotificacion) {
                fixedExpensesReport.notificables++;

                const montoFormatted = `$${Math.round(Number(fe.expected_amount || 0)).toLocaleString('es-CO')}`;
                let notifTitle = '';
                let notifBody = '';

                if (calculo.estado === 'vence_hoy') {
                  notifTitle = `📅 Gasto vence hoy: ${fe.name}`;
                  notifBody = `El gasto "${fe.name}" (${montoFormatted}) vence hoy. Recuerda realizar el pago.`;
                } else if (calculo.estado === 'vencido') {
                  const diasAtras = Math.abs(calculo.diasRestantes);
                  notifTitle = `⚠️ Gasto vencido: ${fe.name}`;
                  notifBody = `El gasto "${fe.name}" (${montoFormatted}) venció hace ${diasAtras} día(s). Recuerda ponerte al día.`;
                } else {
                  notifTitle = `🔔 Gasto próximo a vencer: ${fe.name}`;
                  notifBody = `El gasto "${fe.name}" (${montoFormatted}) vence en ${calculo.diasRestantes} día(s).`;
                }

                const alertPayload = {
                  title: notifTitle,
                  body: notifBody,
                  tag: `fixed-expense-${fe.id}`,
                  link: '/#gastos-fijos',
                  data: {
                    type: 'fixed_expense_alert',
                    gastoId: String(fe.id),
                    estado: calculo.estado,
                    diasRestantes: String(calculo.diasRestantes),
                    url: '/#gastos-fijos',
                  },
                };

                const sent = await dispatchSingleNotification({
                  ...alertPayload,
                  tokens: targetTokens,
                  serviceAccount,
                  accessToken,
                  fcmServerKey,
                  invalidTokensSet,
                  errorDetails,
                });

                if (sent > 0) {
                  fixedExpensesReport.deliveredAlerts += sent;
                }

                fixedExpensesReport.alerts.push({
                  id: fe.id,
                  name: fe.name,
                  estado: calculo.estado,
                  diasRestantes: calculo.diasRestantes,
                  fechaLimite: calculo.fechaLimiteCalculada,
                  deliveredCount: sent,
                });
              }
            }

            // Registrar deduplicación si se evaluó y procesó el lote
            if (fixedExpensesReport.deliveredAlerts > 0) {
              await supabase.from('category_budgets').upsert(
                {
                  category: '__cron_fixed_expenses__',
                  amount: todayColombiaNum,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'category' }
              );
              console.log(`[Cron Gastos Fijos] Alertas del día ${todayColombiaIso} registradas para deduplicación.`);
            }
          }
        } catch (feErr) {
          console.error('[Cron Gastos Fijos] Error en evaluación:', feErr);
          fixedExpensesReport.error = feErr.message;
        }
      }
    }

    // =========================================================================
    // SECCIÓN B: RECORDATORIO DIARIO DE GASTOS NO REGISTRADOS
    // =========================================================================
    const dailyReminderReport = {
      skipped: false,
      reason: null,
      deliveredCount: 0,
    };

    if (cronType === 'all' || cronType === 'daily_reminder') {
      let alreadySentDaily = false;

      // 1. Deduplicación Diaria
      if (!isForce && supabase) {
        try {
          const { data: lastCronLog } = await supabase
            .from('category_budgets')
            .select('amount, updated_at')
            .eq('category', '__cron_reminder_7pm__')
            .maybeSingle();

          if (lastCronLog && Number(lastCronLog.amount) === todayColombiaNum) {
            console.log(`[Cron Reminder] Omitido: El recordatorio de hoy (${todayColombiaIso}) ya fue enviado previamente.`);
            alreadySentDaily = true;
            dailyReminderReport.skipped = true;
            dailyReminderReport.reason = `El recordatorio de las 7:00 PM ya fue enviado hoy (${todayColombiaIso}). Omitiendo duplicado.`;
          }
        } catch (dedupErr) {
          console.warn('[Cron Reminder] Advertencia verificando duplicados:', dedupErr.message);
        }
      }

      // 2. Si la familia ya registró gastos hoy en Colombia, omitir el recordatorio diario
      if (!alreadySentDaily && !isForce && supabase) {
        try {
          const { data: todayExpenses } = await supabase
            .from('expenses')
            .select('id')
            .eq('date', todayColombiaIso)
            .limit(1);

          if (todayExpenses && todayExpenses.length > 0) {
            console.log(`[Cron Reminder] Omitido: Ya se registraron gastos para hoy (${todayColombiaIso}).`);
            alreadySentDaily = true;
            dailyReminderReport.skipped = true;
            dailyReminderReport.reason = `La familia ya registró gastos hoy (${todayColombiaIso}). No se requiere recordatorio.`;
          }
        } catch (expCheckErr) {
          console.warn('[Cron Reminder] Advertencia consultando gastos de hoy:', expCheckErr.message);
        }
      }

      // 3. Despachar recordatorio diario si corresponde
      if (!alreadySentDaily || isForce) {
        const title = 'Recordatorio de Gastos';
        const body = 'Recuerda registrar los gastos que tuviste hoy para mantener las cuentas al día.';

        const sent = await dispatchSingleNotification({
          title,
          body,
          tag: 'daily_reminder_7pm',
          link: '/#gastos',
          data: {
            type: 'daily_reminder',
            slot: 'evening_7pm',
            url: '/#gastos',
          },
          tokens: targetTokens,
          serviceAccount,
          accessToken,
          fcmServerKey,
          invalidTokensSet,
          errorDetails,
        });

        dailyReminderReport.deliveredCount = sent;

        if (sent > 0 && supabase) {
          try {
            await supabase.from('category_budgets').upsert(
              {
                category: '__cron_reminder_7pm__',
                amount: todayColombiaNum,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'category' }
            );
            console.log(`[Cron FCM] Recordatorio del día ${todayColombiaIso} registrado para deduplicación.`);
          } catch (logErr) {
            console.warn('[Cron FCM] Error registrando deduplicación:', logErr.message);
          }
        }
      }
    }

    // =========================================================================
    // LIMPIEZA AUTOMÁTICA DE TOKENS OBSOLETOS
    // =========================================================================
    const invalidTokens = Array.from(invalidTokensSet);
    if (invalidTokens.length > 0 && supabase) {
      try {
        await supabase.from('fcm_tokens').delete().in('token', invalidTokens);
        console.log(`[Cron FCM] Se limpiaron ${invalidTokens.length} tokens obsoletos.`);
      } catch (cleanErr) {
        console.warn('[Cron FCM] Error limpiando tokens en Supabase:', cleanErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      colombiaDate: todayColombiaIso,
      colombiaTime: formattedColombiaTime,
      cronType,
      fixedExpenses: fixedExpensesReport,
      dailyReminder: dailyReminderReport,
      totalTokens: tokens.length,
      cleanedTokens: invalidTokens.length,
      timestamp: new Date().toISOString(),
      diagnostics: {
        authMethod: serviceAccount ? 'fcm_v1' : fcmServerKey ? 'fcm_legacy' : 'none',
        errors: errorDetails.length > 0 ? errorDetails.slice(0, 3) : undefined,
      },
    });
  } catch (err) {
    console.error('Error en cron de recordatorio:', err);
    return res.status(500).json({ error: err.message });
  }
}
