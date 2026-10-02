import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

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
  const signature = signer
    .sign(serviceAccount.private_key, 'base64')
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
  return tokenData.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  let { title, body, icon, data, senderToken } = req.body || {};

  // Soporte para Webhook nativo de Supabase Database (si se dispara directo desde la BD)
  if (!title && req.body?.type === 'INSERT' && req.body?.table && req.body?.record) {
    const record = req.body.record;
    const table = req.body.table;
    const formatNumber = (num) => `$${Math.round(Number(num) || 0).toLocaleString('es-CO')}`;

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
      body = `${formatNumber(record.original_amount || record.originalAmount)} (${record.person || 'Compartido'})`;
      data = { url: '/#deudas', type: 'debt' };
    }
  }

  if (!title || !body) {
    return res.status(400).json({ error: 'Título y cuerpo son requeridos' });
  }

  try {
    let tokens = [];

    // 1. Obtener tokens de Supabase (excluyendo el dispositivo emisor)
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      let query = supabase.from('fcm_tokens').select('token');

      if (senderToken) {
        query = query.neq('token', senderToken);
      }

      const { data: dbTokens, error } = await query;
      if (!error && dbTokens) {
        tokens = dbTokens.map((t) => t.token);
      }
    }

    console.log(`[Push Notification] Despachando a ${tokens.length} dispositivos: "${title}" - "${body}"`);

    let sentCount = 0;

    // 2. Si hay Cuenta de Servicio (FCM v1 moderna) configurada
    let serviceAccount = null;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
        serviceAccount = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
      } catch (e) {
        console.warn('Error al parsear FIREBASE_SERVICE_ACCOUNT:', e);
      }
    }

    if (serviceAccount && tokens.length > 0) {
      try {
        const accessToken = await getGoogleAccessToken(serviceAccount);
        const projectId = serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID;

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
            }
          } catch (e) {
            console.warn('[FCM v1] Fallo de red:', e);
          }
        }
      } catch (err) {
        console.warn('[FCM v1] Error obteniendo token OAuth2:', err);
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

    return res.status(200).json({
      success: true,
      deliveredToTokens: tokens.length,
      fcmSent: sentCount,
      notification: { title, body, icon, data },
    });
  } catch (err) {
    console.error('Error procesando despacho push:', err);
    return res.status(500).json({ error: err.message });
  }
}
