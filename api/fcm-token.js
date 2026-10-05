import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export default async function handler(req, res) {
  // Manejo de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { count, error } = await supabase
          .from('fcm_tokens')
          .select('*', { count: 'exact', head: true });

        if (error) {
          return res.status(200).json({ status: 'error', error: error.message });
        }
        return res.status(200).json({ status: 'ok', registeredTokensCount: count });
      } catch (e) {
        return res.status(500).json({ status: 'error', message: e.message });
      }
    }
    return res.status(200).json({ status: 'unconfigured' });
  }

  if (req.method === 'POST') {
    const { token, person, household_id, device_info } = req.body || {};

    if (!token || !person) {
      return res.status(400).json({ error: 'Faltan parámetros obligatorios: token y person' });
    }

    try {
      if (supabaseUrl && supabaseAnonKey) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { error } = await supabase.from('fcm_tokens').upsert(
          {
            token,
            person,
            household_id: household_id || 'family-home',
            device_info: device_info || '',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'token' }
        );

        if (error) {
          console.warn('Error guardando en Supabase fcm_tokens:', error.message);
        }
      }

      return res.status(200).json({
        success: true,
        message: `Token FCM registrado para ${person}`,
        token,
      });
    } catch (err) {
      console.error('Error al registrar token FCM:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    const { token } = req.body || {};
    if (token && supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      await supabase.from('fcm_tokens').delete().eq('token', token);
    }
    return res.status(200).json({ success: true, message: 'Token eliminado' });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
