import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, string>;
  targetPerson?: 'Benny' | 'Charlie' | 'all';
  household_id?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Manejo de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { title, body, icon, data, targetPerson, household_id } = (req.body || {}) as PushNotificationPayload;

  if (!title || !body) {
    return res.status(400).json({ error: 'Título y cuerpo son requeridos' });
  }

  try {
    let tokens: string[] = [];

    // 1. Obtener tokens de Supabase
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      let query = supabase.from('fcm_tokens').select('token, person');

      if (targetPerson && targetPerson !== 'all') {
        query = query.eq('person', targetPerson);
      }

      const { data: dbTokens, error } = await query;
      if (!error && dbTokens) {
        tokens = dbTokens.map((t: any) => t.token);
      }
    }

    console.log(`[Push Notification] Despachando a ${tokens.length} dispositivos: "${title}" - "${body}"`);

    // 2. Si hay claves de Firebase Server / Service Account configuradas en el entorno, despachar a FCM
    const fcmServerKey = process.env.FIREBASE_SERVER_KEY || process.env.FCM_SERVER_KEY;
    let sentCount = 0;

    if (fcmServerKey && tokens.length > 0) {
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
              notification: {
                title,
                body,
                icon: icon || '/favicon.svg',
              },
              data: data || {},
            }),
          });
          if (response.ok) {
            sentCount++;
          }
        } catch (e) {
          console.warn('Error enviando mensaje a token FCM:', e);
        }
      }
    }

    return res.status(200).json({
      success: true,
      deliveredToTokens: tokens.length,
      fcmSent: sentCount,
      notification: { title, body, icon, data },
    });
  } catch (err: any) {
    console.error('Error procesando despacho push:', err);
    return res.status(500).json({ error: err.message });
  }
}
