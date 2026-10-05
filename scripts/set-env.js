const fs = require('fs');
const path = require('path');

// 1. Cargar archivo .env local si existe (para desarrollo local)
const envFilePath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envFilePath)) {
  const envConfig = fs.readFileSync(envFilePath, 'utf8');
  envConfig.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // Prioridad a variables ya existentes en process.env (como las de CI/CD)
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

// 2. Determinar entorno objetivo (dev vs prod)
// Prioridad: argumento CLI (--env=dev|prod) > variable APP_ENV > rama Git (CI) > NODE_ENV / VERCEL_ENV
const args = process.argv.slice(2);
let targetEnv = null;

const envArg = args.find((arg) => arg.startsWith('--env='));
if (envArg) {
  targetEnv = envArg.split('=')[1].toLowerCase();
} else if (process.env.APP_ENV) {
  targetEnv = process.env.APP_ENV.toLowerCase();
} else {
  const gitBranch = process.env.CI_COMMIT_BRANCH || process.env.GITHUB_REF_NAME || '';
  if (gitBranch === 'main' || gitBranch.startsWith('release/')) {
    targetEnv = 'prod';
  } else if (gitBranch === 'develop' || gitBranch.startsWith('feature/') || gitBranch.startsWith('fix/')) {
    targetEnv = 'dev';
  } else if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    targetEnv = 'prod';
  } else {
    targetEnv = 'dev';
  }
}

const isProduction = targetEnv === 'prod' || targetEnv === 'production';
const envLabel = isProduction ? 'PRODUCCIÓN (PDN)' : 'DESARROLLO (DEV)';

// 3. Extraer credenciales según el entorno objetivo con fallback inteligente
const supabaseUrl = isProduction
  ? (process.env.SUPABASE_URL_PROD || process.env.SUPABASE_URL || '')
  : (process.env.SUPABASE_URL_DEV || process.env.SUPABASE_URL || '');

const supabaseAnonKey = isProduction
  ? (process.env.SUPABASE_ANON_KEY_PROD || process.env.SUPABASE_ANON_KEY || '')
  : (process.env.SUPABASE_ANON_KEY_DEV || process.env.SUPABASE_ANON_KEY || '');

const firebaseConfig = {
  apiKey: isProduction
    ? (process.env.FIREBASE_API_KEY_PROD || process.env.FIREBASE_API_KEY || '')
    : (process.env.FIREBASE_API_KEY_DEV || process.env.FIREBASE_API_KEY || ''),
  authDomain: isProduction
    ? (process.env.FIREBASE_AUTH_DOMAIN_PROD || process.env.FIREBASE_AUTH_DOMAIN || '')
    : (process.env.FIREBASE_AUTH_DOMAIN_DEV || process.env.FIREBASE_AUTH_DOMAIN || ''),
  projectId: isProduction
    ? (process.env.FIREBASE_PROJECT_ID_PROD || process.env.FIREBASE_PROJECT_ID || '')
    : (process.env.FIREBASE_PROJECT_ID_DEV || process.env.FIREBASE_PROJECT_ID || ''),
  storageBucket: isProduction
    ? (process.env.FIREBASE_STORAGE_BUCKET_PROD || process.env.FIREBASE_STORAGE_BUCKET || '')
    : (process.env.FIREBASE_STORAGE_BUCKET_DEV || process.env.FIREBASE_STORAGE_BUCKET || ''),
  messagingSenderId: isProduction
    ? (process.env.FIREBASE_MESSAGING_SENDER_ID_PROD || process.env.FIREBASE_MESSAGING_SENDER_ID || '')
    : (process.env.FIREBASE_MESSAGING_SENDER_ID_DEV || process.env.FIREBASE_MESSAGING_SENDER_ID || ''),
  appId: isProduction
    ? (process.env.FIREBASE_APP_ID_PROD || process.env.FIREBASE_APP_ID || '')
    : (process.env.FIREBASE_APP_ID_DEV || process.env.FIREBASE_APP_ID || ''),
  measurementId: isProduction
    ? (process.env.FIREBASE_MEASUREMENT_ID_PROD || process.env.FIREBASE_MEASUREMENT_ID || '')
    : (process.env.FIREBASE_MEASUREMENT_ID_DEV || process.env.FIREBASE_MEASUREMENT_ID || ''),
  vapidKey: isProduction
    ? (process.env.FIREBASE_VAPID_KEY_PROD || process.env.FIREBASE_VAPID_KEY || '')
    : (process.env.FIREBASE_VAPID_KEY_DEV || process.env.FIREBASE_VAPID_KEY || ''),
};

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '\x1b[33m%s\x1b[0m',
    `⚠️ ADVERTENCIA: SUPABASE_URL o SUPABASE_ANON_KEY para [${envLabel}] no están definidas. Revisa tu archivo .env o las variables de CI/CD.`
  );
}

const apiUrl = isProduction
  ? (process.env.APP_BASE_URL_PROD || process.env.APP_BASE_URL || 'https://finanzas-hogar-control-familiar.vercel.app')
  : (process.env.APP_BASE_URL_DEV || process.env.APP_BASE_URL || 'https://finanzas-hogar-control-familiar.vercel.app');

// 4. Generar archivos environment.ts y environment.development.ts
const targetDir = path.resolve(__dirname, '../src/environments');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const envFileContent = (isProd) => `// Archivo generado automáticamente por scripts/set-env.js
// NO MODIFICAR MANUALMENTE NI SUBIR A CONTROL DE VERSIONES
// Entorno activo: ${envLabel}
export const environment = {
  production: ${isProd},
  apiUrl: '${apiUrl}',
  supabaseUrl: '${supabaseUrl}',
  supabaseAnonKey: '${supabaseAnonKey}',
  firebase: ${JSON.stringify(firebaseConfig, null, 2).replace(/\n/g, '\n  ')},
};
`;

fs.writeFileSync(path.join(targetDir, 'environment.ts'), envFileContent(isProduction), 'utf8');
fs.writeFileSync(path.join(targetDir, 'environment.development.ts'), envFileContent(false), 'utf8');

console.log(
  '\x1b[32m%s\x1b[0m',
  `✅ [ENV] Configuración inyectada con éxito para: ${envLabel}`
);
if (supabaseUrl) {
  try {
    const urlObj = new URL(supabaseUrl);
    console.log('\x1b[36m%s\x1b[0m', `📡 [DB] Host Supabase: ${urlObj.host}`);
  } catch {
    console.log('\x1b[36m%s\x1b[0m', `📡 [DB] Host Supabase configurado`);
  }
}
