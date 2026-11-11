import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://finanzas-hogar-control-familiar.vercel.app',
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'http://localhost:4200',
  'http://127.0.0.1:4200',
];

function normalizeOrigin(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function getAllowedOrigins() {
  const allowed = new Set(DEFAULT_ALLOWED_ORIGINS);

  const envUrls = [
    process.env.APP_BASE_URL,
    process.env.APP_BASE_URL_PROD,
    process.env.APP_BASE_URL_DEV,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '',
  ];

  for (const candidate of envUrls) {
    const normalized = normalizeOrigin(candidate);
    if (normalized) {
      allowed.add(normalized);
    }
  }

  if (process.env.ALLOWED_ORIGINS) {
    for (const part of process.env.ALLOWED_ORIGINS.split(',')) {
      const normalized = normalizeOrigin(part);
      if (normalized) {
        allowed.add(normalized);
      }
    }
  }

  return allowed;
}

export function applyCors(req, res, methods = 'GET, POST, OPTIONS') {
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const rawOrigin = req?.headers?.origin;
  if (!rawOrigin) {
    return { allowed: true, origin: null };
  }

  const normalized = normalizeOrigin(rawOrigin);
  const allowedOrigins = getAllowedOrigins();

  if (normalized && allowedOrigins.has(normalized)) {
    res.setHeader('Access-Control-Allow-Origin', normalized);
    return { allowed: true, origin: normalized };
  }

  return { allowed: false, origin: rawOrigin };
}

export function extractBearerToken(req) {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || '';
  if (typeof authHeader !== 'string') return '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return '';
  return authHeader.slice(7).trim();
}

export function timingSafeEqualSecret(provided, expected) {
  if (!provided || !expected || typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }
  const providedDigest = crypto.createHash('sha256').update(provided, 'utf8').digest();
  const expectedDigest = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(providedDigest, expectedDigest);
}

export async function verifySupabaseUserToken(token, supabaseUrl, supabaseAnonKey) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, configured: false, user: null };
  }
  if (!token) {
    return { ok: false, configured: true, user: null };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      return { ok: true, configured: true, user: data.user };
    }
    return { ok: false, configured: true, user: null };
  } catch {
    return { ok: false, configured: true, user: null };
  }
}

export function createSupabaseClientForRequest({
  supabaseUrl,
  supabaseServiceRoleKey,
  supabaseAnonKey,
  userToken,
}) {
  if (!supabaseUrl) return null;

  if (supabaseServiceRoleKey) {
    return createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  if (supabaseAnonKey && userToken) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      },
    });
  }

  return null;
}
