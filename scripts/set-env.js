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
      // Prioridad a variables ya existentes en process.env (como las de GitLab CI/CD)
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

// 2. Extraer las credenciales (desde .env o desde Secrets/Variables de GitLab CI/CD)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || '',
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || '',
  vapidKey: process.env.FIREBASE_VAPID_KEY || '',
};

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '\x1b[33m%s\x1b[0m',
    '⚠️ ADVERTENCIA: SUPABASE_URL o SUPABASE_ANON_KEY no están definidas. Revisa tu archivo .env o las variables de CI/CD.'
  );
}

// 3. Contenido para environment.ts y environment.development.ts
const targetDir = path.resolve(__dirname, '../src/environments');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const envFileContent = (isProd) => `// Archivo generado automáticamente por scripts/set-env.js
// NO MODIFICAR MANUALMENTE NI SUBIR A CONTROL DE VERSIONES
export const environment = {
  production: ${isProd},
  supabaseUrl: '${supabaseUrl}',
  supabaseAnonKey: '${supabaseAnonKey}',
  firebase: ${JSON.stringify(firebaseConfig, null, 2).replace(/\n/g, '\n  ')},
};
`;

// 4. Escribir archivos
const isProd = process.env.VERCEL_ENV
  ? process.env.VERCEL_ENV === 'production'
  : process.env.NODE_ENV === 'production';

fs.writeFileSync(path.join(targetDir, 'environment.ts'), envFileContent(isProd), 'utf8');
fs.writeFileSync(path.join(targetDir, 'environment.development.ts'), envFileContent(false), 'utf8');

console.log('\x1b[32m%s\x1b[0m', '✅ Archivos de entorno generados dinámicamente con éxito.');
