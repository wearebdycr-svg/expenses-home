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

  try {
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
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
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

    // 2. Parsear cuenta de servicio
    let serviceAccount = null;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
        serviceAccount = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
      } catch (e) {
        console.warn('Error al parsear FIREBASE_SERVICE_ACCOUNT en cron:', e);
      }
    }

    let sentCount = 0;

    if (serviceAccount && tokens.length > 0) {
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
          }
        } catch (e) {
          console.warn('[Cron FCM] Error enviando a token:', e);
        }
      }
    }

    // Fallback Legacy si aplica
    const fcmServerKey = process.env.FIREBASE_SERVER_KEY || process.env.FCM_SERVER_KEY;
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
              notification: { title, body, icon: '/favicon.svg' },
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

    return res.status(200).json({
      success: true,
      slot: isMorning ? 'morning' : 'evening',
      deliveredCount: sentCount,
      totalTokens: tokens.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error en cron de recordatorio:', err);
    return res.status(500).json({ error: err.message });
  }
}
