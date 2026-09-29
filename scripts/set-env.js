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
};
`;

// 4. Escribir archivos
fs.writeFileSync(path.join(targetDir, 'environment.ts'), envFileContent(true), 'utf8');
fs.writeFileSync(path.join(targetDir, 'environment.development.ts'), envFileContent(false), 'utf8');

console.log('\x1b[32m%s\x1b[0m', '✅ Archivos de entorno generados dinámicamente con éxito.');
