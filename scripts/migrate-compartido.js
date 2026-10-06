const https = require('https');

const devUrl = process.argv[2] || process.env.DEV_SUPABASE_URL;
const devKey = process.argv[3] || process.env.DEV_SUPABASE_ANON_KEY;

if (!devUrl || !devKey) {
  console.error('Uso: node scripts/migrate-compartido.js <SUPABASE_URL> <SUPABASE_ANON_KEY>');
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(devUrl);
} catch {
  console.error('URL inválida');
  process.exit(1);
}

if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
  console.error('SSRF Protection: Solo se permiten URLs HTTPS de dominios *.supabase.co');
  process.exit(1);
}

const hostname = parsedUrl.hostname;

function sendRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname,
        path,
        method,
        headers: {
          apikey: devKey,
          Authorization: `Bearer ${devKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(d ? JSON.parse(d) : null);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${d}`));
          }
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  console.log(`🔍 Buscando gastos con person = 'Compartido' en ${hostname}...`);
  const sharedExpenses = await sendRequest('/rest/v1/expenses?person=eq.Compartido&select=*', 'GET');

  if (!sharedExpenses || sharedExpenses.length === 0) {
    console.log('ℹ️ No se encontraron gastos marcados como "Compartido" en expenses.');
    return;
  }

  console.log(`📦 Se encontraron ${sharedExpenses.length} gastos compartidos:`);
  let totalAmount = 0;
  for (const exp of sharedExpenses) {
    console.log(`   - [${exp.date}] ${exp.description}: $${exp.amount.toLocaleString()} (${exp.category})`);
    totalAmount += Number(exp.amount);
  }
  console.log(`   Total monto compartido: $${totalAmount.toLocaleString()}`);

  console.log('\n🚀 Migrando registros a tc_expenses...');
  // Formatear para tc_expenses
  const tcRows = sharedExpenses.map((exp) => ({
    id: exp.id.toString(),
    date: exp.date,
    person: exp.person,
    description: exp.description,
    amount: exp.amount,
    category: exp.category || 'General',
    created_at: exp.created_at,
  }));

  const inserted = await sendRequest('/rest/v1/tc_expenses', 'POST', tcRows);
  console.log(`✅ ${inserted ? inserted.length : tcRows.length} registros insertados en tc_expenses.`);

  console.log('\n🗑️ Eliminando gastos compartidos de expenses para que no aparezcan en Gastos Diarios...');
  await sendRequest('/rest/v1/expenses?person=eq.Compartido', 'DELETE');
  console.log('✅ Registros eliminados de expenses exitosamente.');

  // Verificar estado
  const remainingInExpenses = await sendRequest('/rest/v1/expenses?person=eq.Compartido&select=id', 'GET');
  const allTc = await sendRequest('/rest/v1/tc_expenses?select=id,person,amount,description', 'GET');

  console.log('\n📊 Verificación final:');
  console.log(`   - Gastos "Compartido" restantes en expenses: ${remainingInExpenses.length}`);
  console.log(`   - Total registros en tc_expenses: ${allTc.length}`);
}

run().catch((err) => {
  console.error('❌ Error en la migración:', err.message);
  process.exit(1);
});
