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

    // 3. Ventana de Seguridad Estricta para Hora Colombia:
    // El recordatorio está configurado para las 7:00 PM (19:00).
    // Para evitar notificaciones en la madrugada (por retrasos en colas de runners como GitHub Actions),
    // bloqueamos el envío fuera de la ventana permitida (18:45 a 20:15 hora Colombia).
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

    // 5. Deduplicación Diaria: Asegurar que SOLO se envíe 1 recordatorio por día
    if (!isForce && supabase) {
      try {
        const { data: lastCronLog } = await supabase
          .from('category_budgets')
          .select('amount, updated_at')
          .eq('category', '__cron_reminder_7pm__')
          .maybeSingle();

        if (lastCronLog && Number(lastCronLog.amount) === todayColombiaNum) {
          console.log(`[Cron Reminder] Omitido: El recordatorio de hoy (${todayColombiaIso}) ya fue enviado previamente.`);
          return res.status(200).json({
            success: true,
            skipped: true,
            reason: `El recordatorio de las 7:00 PM ya fue enviado hoy (${todayColombiaIso}). Omitiendo duplicado.`,
            lastSentAt: lastCronLog.updated_at,
          });
        }
      } catch (dedupErr) {
        console.warn('[Cron Reminder] Advertencia verificando duplicados:', dedupErr.message);
      }
    }

    // 6. Si la familia ya registró gastos hoy en Colombia, omitir el recordatorio
    if (!isForce && supabase) {
      try {
        const { data: todayExpenses } = await supabase
          .from('expenses')
          .select('id')
          .eq('date', todayColombiaIso)
          .limit(1);

        if (todayExpenses && todayExpenses.length > 0) {
          console.log(`[Cron Reminder] Omitido: Ya se registraron gastos para hoy (${todayColombiaIso}).`);
          return res.status(200).json({
            success: true,
            skipped: true,
            reason: `La familia ya registró gastos hoy (${todayColombiaIso}). No se requiere recordatorio.`,
          });
        }
      } catch (expCheckErr) {
        console.warn('[Cron Reminder] Advertencia consultando gastos de hoy:', expCheckErr.message);
      }
    }

    // 7. Obtener los tokens FCM de los dispositivos registrados
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

    const title = 'Recordatorio de Gastos';
    const body = 'Recuerda registrar los gastos que tuviste hoy para mantener las cuentas al día.';

    // 8. Control de consumo de recursos y preparación de lote (CWE-400)
    const MAX_CRON_TOKENS = 50;
    const targetTokens = tokens.slice(0, MAX_CRON_TOKENS);

    // 3. Parsear cuenta de servicio
    const serviceAccount = getServiceAccount();
    let sentCount = 0;
    const invalidTokens = [];
    const errorDetails = [];

    if (serviceAccount && targetTokens.length > 0) {
      try {
        const accessToken = await getGoogleAccessToken(serviceAccount);
        const projectId = serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || 'expenses-home';

        for (const token of targetTokens) {
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
                      },
                    },
                    webpush: {
                      notification: {
                        title,
                        body,
                        icon: '/favicon.svg',
                        badge: '/favicon.svg',
                      },
                      fcm_options: {
                        link: '/#gastos',
                      },
                    },
                    data: {
                      type: 'daily_reminder',
                      slot: 'evening_7pm',
                      url: '/#gastos',
                    },
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

              // Identificar tokens desinstalados o expirados para limpieza automática
              if (
                errBody.includes('UNREGISTERED') ||
                errBody.includes('NOT_FOUND') ||
                errBody.includes('Requested entity was not found') ||
                errBody.includes('INVALID_ARGUMENT')
              ) {
                invalidTokens.push(token);
              }
            }
          } catch (e) {
            console.warn('[Cron FCM] Fallo de red:', e);
            errorDetails.push(e.message);
          }
        }
      } catch (oauthErr) {
        console.warn('[Cron FCM] Error obteniendo token OAuth2:', oauthErr);
        errorDetails.push(`OAuth error: ${oauthErr.message}`);
      }
    }

    // 4. Fallback Legacy si aplica
    const fcmServerKey = process.env.FIREBASE_SERVER_KEY || process.env.FCM_SERVER_KEY;
    if (!sentCount && fcmServerKey && targetTokens.length > 0) {
      for (const token of targetTokens) {
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
              },
              data: { type: 'daily_reminder', slot: 'evening_7pm', url: '/#gastos' },
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

    // 9. Registrar envío exitoso de hoy para evitar cualquier duplicación
    if (sentCount > 0 && supabase) {
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

    // 10. Limpieza automática de tokens obsoletos/dados de baja en Supabase
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
      slot: 'evening_7pm',
      colombiaDate: todayColombiaIso,
      colombiaTime: formattedColombiaTime,
      deliveredCount: sentCount,
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
