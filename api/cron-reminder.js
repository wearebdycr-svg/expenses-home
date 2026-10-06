import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

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

    const nowUtc = new Date();
    const utcHour = nowUtc.getUTCHours();
    const querySlot = req.query?.slot || req.query?.time;

    // Determinar si es recordatorio matutino (14:00 UTC = 9:00 AM Colombia) o nocturno (02:00 UTC = 9:00 PM Colombia)
    const isMorning = querySlot === 'morning' || (!querySlot && utcHour >= 10 && utcHour <= 18);

    const title = isMorning
      ? '☀️ Recordatorio de Gastos (9:00 AM)'
      : '🌙 Recordatorio de Gastos (9:00 PM)';

    const body = isMorning
      ? '¡Buenos días! ¿Tuviste gastos hoy o pendientes de ayer? No olvides reportarlos en FinanzasHogar.'
      : '¡Buenas noches! No olvides reportar los gastos del día en FinanzasHogar para mantener las cuentas al día.';

    // 1. Obtener todos los tokens registrados
    let tokens = [];
    let supabase = null;
    if (supabaseUrl && supabaseAnonKey) {
      supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: dbTokens, error } = await supabase.from('fcm_tokens').select('token');
      if (!error && dbTokens) {
        tokens = dbTokens.map((t) => t.token);
      }
    }

    if (tokens.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay tokens registrados para enviar recordatorios.',
        slot: isMorning ? 'morning' : 'evening',
      });
    }

    // 2. Control de consumo de recursos y preparación de lote (CWE-400)
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
                      slot: isMorning ? 'morning' : 'evening',
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
              data: { type: 'daily_reminder', slot: isMorning ? 'morning' : 'evening', url: '/#gastos' },
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

    // 4. Limpieza automática de tokens obsoletos/dados de baja en Supabase
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
      slot: isMorning ? 'morning' : 'evening',
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
