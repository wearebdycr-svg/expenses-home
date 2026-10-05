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
      console.warn('[FCM] Error al parsear FIREBASE_SERVICE_ACCOUNT:', e.message);
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

  if (req.method === 'GET') {
    const serviceAccount = getServiceAccount();
    const fcmServerKey = process.env.FIREBASE_SERVER_KEY || process.env.FCM_SERVER_KEY;
    return res.status(200).json({
      status: 'online',
      hasSupabaseConfig: !!(supabaseUrl && supabaseAnonKey),
      dbHost: supabaseUrl ? new URL(supabaseUrl).host : 'none',
      authMethod: serviceAccount ? 'fcm_v1' : fcmServerKey ? 'fcm_legacy' : 'none',
      projectId: serviceAccount?.project_id || process.env.FIREBASE_PROJECT_ID || 'expenses-home',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  let { title, body, icon, data, senderToken } = req.body || {};

  // Soporte para Webhook nativo de Supabase Database (INSERT o DELETE)
  if (!title && req.body?.table) {
    const isInsert = req.body?.type === 'INSERT' && req.body?.record;
    const isDelete = req.body?.type === 'DELETE' && (req.body?.old_record || req.body?.record);
    const record = isInsert ? req.body.record : isDelete ? (req.body.old_record || req.body.record) : null;
    const table = req.body.table;
    const formatNumber = (num) => `$${Math.round(Number(num) || 0).toLocaleString('es-CO')}`;

    if (record) {
      if (isInsert) {
        if (table === 'expenses') {
          const creator = record.person || 'Alguien';
          title = creator === 'Compartido' ? '💸 Nuevo Gasto Compartido' : `💸 ${creator} registró un gasto`;
          body = `${formatNumber(record.amount)} en ${record.category || 'Varios'}${record.description ? ` (${record.description})` : ''}`;
          data = { url: '/#gastos', type: 'expense' };
        } else if (table === 'tc_expenses') {
          const creator = record.person || 'Alguien';
          title = `💳 ${creator} usó la TC Compartida`;
          body = `${formatNumber(record.amount)} - ${record.description || record.category || 'Consumo'}`;
          data = { url: '/#tc-compartida', type: 'tc_expense' };
        } else if (table === 'incomes') {
          const person = record.person || 'Alguien';
          title = `💰 ${person} registró un ingreso`;
          body = `${formatNumber(record.amount)} en ${record.source || 'Ingreso'}${record.description ? ` (${record.description})` : ''}`;
          data = { url: '/#ingresos', type: 'income' };
        } else if (table === 'debts') {
          title = `📋 Nueva deuda registrada: ${record.name || 'Deuda'}`;
          body = `${formatNumber(record.original_amount || record.originalAmount || 0)} (${record.person || 'Compartido'})`;
          data = { url: '/#deudas', type: 'debt' };
        }
      } else if (isDelete) {
        if (table === 'expenses') {
          const creator = record.person || 'Alguien';
          title = creator === 'Compartido' ? '🗑️ Gasto Compartido Eliminado' : `🗑️ ${creator} eliminó un gasto`;
          body = `${formatNumber(record.amount)} en ${record.category || 'Varios'}${record.description ? ` (${record.description})` : ''}`;
          data = { url: '/#gastos', type: 'expense_deleted' };
        } else if (table === 'tc_expenses') {
          const creator = record.person || 'Alguien';
          title = `🗑️ Consumo TC Eliminado (${creator})`;
          body = `${formatNumber(record.amount)} - ${record.description || record.category || 'Consumo'}`;
          data = { url: '/#tc-compartida', type: 'tc_expense_deleted' };
        } else if (table === 'incomes') {
          const person = record.person || 'Alguien';
          title = `🗑️ Ingreso Eliminado (${person})`;
          body = `${formatNumber(record.amount)} de ${record.source || 'Ingreso'}${record.description ? ` (${record.description})` : ''}`;
          data = { url: '/#ingresos', type: 'income_deleted' };
        } else if (table === 'debts') {
          title = `🗑️ Deuda Eliminada: ${record.name || 'Deuda'}`;
          body = `${formatNumber(record.original_amount || record.originalAmount || 0)} (${record.person || 'Compartido'})`;
          data = { url: '/#deudas', type: 'debt_deleted' };
        }
      }
    }
  }

  if (!title || !body) {
    return res.status(400).json({ error: 'Título y cuerpo son requeridos' });
  }

  try {
    let tokens = [];
    let supabase = null;

    // 1. Obtener tokens de Supabase (excluyendo el dispositivo emisor)
    if (supabaseUrl && supabaseAnonKey) {
      supabase = createClient(supabaseUrl, supabaseAnonKey);
      let query = supabase.from('fcm_tokens').select('token');

      // Por defecto despachamos a todos los dispositivos del hogar (incluyendo confirmación en el propio móvil).
      // Solo excluimos el emisor si explícitamente se solicita excludeSender: true.
      if (senderToken && req.body?.excludeSender === true) {
        query = query.neq('token', senderToken);
      }

      const { data: dbTokens, error } = await query;
      if (!error && dbTokens) {
        tokens = dbTokens.map((t) => t.token);
      }
    }

    console.log(`[Push Notification] Despachando a ${tokens.length} dispositivos: "${title}" - "${body}"`);

    let sentCount = 0;
    const invalidTokens = [];
    const errorDetails = [];

    // 2. Si hay Cuenta de Servicio (FCM v1 moderna) configurada
    const serviceAccount = getServiceAccount();

    if (serviceAccount && tokens.length > 0) {
      try {
        const accessToken = await getGoogleAccessToken(serviceAccount);
        const projectId = serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || 'expenses-home';

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
                      },
                    },
                    webpush: {
                      notification: {
                        title,
                        body,
                        icon: icon || '/favicon.svg',
                        badge: '/favicon.svg',
                      },
                      fcm_options: {
                        link: data?.url || '/#gastos',
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
              console.warn('[FCM v1] Error enviando a token:', errBody);
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
            console.warn('[FCM v1] Fallo de red:', e);
            errorDetails.push(e.message);
          }
        }
      } catch (err) {
        console.warn('[FCM v1] Error obteniendo token OAuth2:', err);
        errorDetails.push(`OAuth error: ${err.message}`);
      }
    }

    // 3. Respaldo: Si hay clave de servidor heredada (FCM legacy)
    const fcmServerKey = process.env.FIREBASE_SERVER_KEY || process.env.FCM_SERVER_KEY;
    if (!sentCount && fcmServerKey && tokens.length > 0) {
      for (const token of tokens) {
        try {
          const response = await fetch('https://fcm.googleapis.com/fcm/send', {
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
                icon: icon || '/favicon.svg',
              },
              data: data || {},
            }),
          });
          if (response.ok) {
            sentCount++;
          }
        } catch (e) {
          console.warn('Error enviando mensaje legacy a token FCM:', e);
        }
      }
    }

    // 4. Limpieza automática de tokens obsoletos/dados de baja en Supabase
    if (invalidTokens.length > 0 && supabase) {
      try {
        await supabase.from('fcm_tokens').delete().in('token', invalidTokens);
        console.log(`[FCM v1] Se limpiaron ${invalidTokens.length} tokens obsoletos.`);
      } catch (cleanErr) {
        console.warn('[FCM v1] Error limpiando tokens en Supabase:', cleanErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      deliveredToTokens: tokens.length,
      fcmSent: sentCount,
      cleanedTokens: invalidTokens.length,
      notification: { title, body, icon, data },
      diagnostics: {
        authMethod: serviceAccount ? 'fcm_v1' : fcmServerKey ? 'fcm_legacy' : 'none',
        hasServiceAccount: !!serviceAccount,
        hasServerKey: !!fcmServerKey,
        errors: errorDetails.length > 0 ? errorDetails.slice(0, 3) : undefined,
      },
    });
  } catch (err) {
    console.error('Error procesando despacho push:', err);
    return res.status(500).json({ error: err.message });
  }
}
