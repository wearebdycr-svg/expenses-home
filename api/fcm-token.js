import {
  applyCors,
  createSupabaseClientForRequest,
  extractBearerToken,
  timingSafeEqualSecret,
  verifySupabaseUserToken,
} from './_security.js';

export default async function handler(req, res) {
  const cors = applyCors(req, res, 'GET, POST, OPTIONS, DELETE');
  if (!cors.allowed) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const serverSecret = process.env.NOTIFY_SECRET || process.env.CRON_SECRET || '';

  const bearerToken = extractBearerToken(req);
  const isServerCaller = timingSafeEqualSecret(bearerToken, serverSecret);
  const jwtResult = isServerCaller
    ? { ok: false, configured: Boolean(supabaseUrl && supabaseAnonKey), user: null }
    : await verifySupabaseUserToken(bearerToken, supabaseUrl, supabaseAnonKey);

  if (!serverSecret && !jwtResult.configured) {
    return res.status(500).json({ error: 'Server misconfigured: authentication backend unavailable' });
  }

  if (!isServerCaller && !jwtResult.ok) {
    return res.status(401).json({ error: 'Unauthorized: Se requiere sesión autenticada válida' });
  }

  const supabase = createSupabaseClientForRequest({
    supabaseUrl,
    supabaseServiceRoleKey,
    supabaseAnonKey,
    userToken: jwtResult.ok ? bearerToken : '',
  });

  if (!supabase) {
    return res.status(500).json({ error: 'Server misconfigured: Supabase credentials unavailable' });
  }

  if (req.method === 'GET') {
    try {
      const { count, error } = await supabase
        .from('fcm_tokens')
        .select('*', { count: 'exact', head: true });

      if (error) {
        return res.status(500).json({ status: 'error', error: error.message });
      }
      return res.status(200).json({ status: 'ok', registeredTokensCount: count ?? 0 });
    } catch (e) {
      return res.status(500).json({ status: 'error', message: e.message });
    }
  }

  if (req.method === 'POST') {
    const { token: fcmToken, person, household_id, device_info } = req.body || {};

    if (
      typeof fcmToken !== 'string' ||
      fcmToken.trim().length <= 10 ||
      fcmToken.trim().length > 4096 ||
      typeof person !== 'string' ||
      person.trim().length === 0 ||
      person.trim().length > 100
    ) {
      return res.status(400).json({ error: 'Parámetros inválidos o faltantes: token y person' });
    }

    try {
      const { error } = await supabase.from('fcm_tokens').upsert(
        {
          token: fcmToken.trim(),
          person: person.trim(),
          household_id: typeof household_id === 'string' && household_id.trim() ? household_id.trim() : 'family-home',
          device_info: typeof device_info === 'string' ? device_info.slice(0, 500) : '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      );

      if (error) {
        console.warn('Error guardando en Supabase fcm_tokens:', error.message);
        return res.status(500).json({ error: 'No se pudo registrar el token FCM' });
      }

      return res.status(200).json({
        success: true,
        message: `Token FCM registrado para ${person.trim()}`,
      });
    } catch (err) {
      console.error('Error al registrar token FCM:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    const { token: fcmToken } = req.body || {};
    if (typeof fcmToken !== 'string' || fcmToken.trim().length === 0) {
      return res.status(400).json({ error: 'Parámetro obligatorio faltante: token' });
    }

    try {
      const { error } = await supabase.from('fcm_tokens').delete().eq('token', fcmToken.trim());
      if (error) {
        return res.status(500).json({ error: 'No se pudo eliminar el token FCM' });
      }
      return res.status(200).json({ success: true, message: 'Token eliminado' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
