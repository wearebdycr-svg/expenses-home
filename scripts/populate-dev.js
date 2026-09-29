const https = require('https');

const devUrl = process.argv[2] || process.env.DEV_SUPABASE_URL;
const devKey = process.argv[3] || process.env.DEV_SUPABASE_ANON_KEY;

if (!devUrl || !devKey) {
  console.error('Uso: node scripts/populate-dev.js <DEV_SUPABASE_URL> <DEV_SUPABASE_ANON_KEY>');
  process.exit(1);
}

const hostname = devUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

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

async function main() {
  console.log(`🚀 Poblando base de datos de pruebas en: ${hostname}...`);

  // 1. Personas
  console.log('1. Registrando personas...');
  try {
    await sendRequest('/rest/v1/persons', 'POST', [
      { id: 'benny', name: 'Benny', color: '#3B82F6' },
      { id: 'charlie', name: 'Charlie', color: '#F59E0B' },
      { id: 'compartido', name: 'Compartido', color: '#10B981' },
    ]);
  } catch (err) {
    console.log('   (Personas ya registradas, continuando...)');
  }

  // 2. Ingresos
  console.log('2. Registrando ingresos...');
  await sendRequest('/rest/v1/incomes', 'POST', [
    { date: '2026-07-01', person: 'Benny', source: 'Salario', description: 'Salario mensual Benny', amount: 4500000 },
    { date: '2026-07-01', person: 'Charlie', source: 'Salario', description: 'Salario mensual Charlie', amount: 4200000 },
    { date: '2026-07-15', person: 'Benny', source: 'Freelance', description: 'Consultoría UI/UX', amount: 850000 },
    { date: '2026-07-20', person: 'Charlie', source: 'Inversiones', description: 'Rendimientos CDT', amount: 180000 },
  ]);

  // 3. Gastos Diarios
  console.log('3. Registrando gastos diarios...');
  await sendRequest('/rest/v1/expenses', 'POST', [
    { date: '2026-07-05', person: 'Compartido', category: 'Hogar', description: 'Arriendo apartamento', amount: 1800000 },
    { date: '2026-07-08', person: 'Compartido', category: 'Servicios', description: 'Servicios públicos (Agua, Luz, Gas)', amount: 320000 },
    { date: '2026-07-09', person: 'Charlie', category: 'Restaurantes', description: 'Cena Sushi', amount: 90000 },
    { date: '2026-07-10', person: 'Benny', category: 'Alimentación', description: 'Mercado mensual Éxito', amount: 200000 },
    { date: '2026-07-12', person: 'Charlie', category: 'Transporte', description: 'Gasolina vehículo', amount: 150000 },
    { date: '2026-07-15', person: 'Benny', category: 'Salud', description: 'Medicamentos Farmacia', amount: 75000 },
    { date: '2026-07-18', person: 'Compartido', category: 'Servicios', description: 'Internet fibra óptica', amount: 110000 },
    { date: '2026-07-22', person: 'Charlie', category: 'Restaurantes', description: 'Almuerzo familiar', amount: 120000 },
    { date: '2026-07-25', person: 'Benny', category: 'Entretenimiento', description: 'Boletas de Cine', amount: 28216 },
    { date: '2026-07-27', person: 'Benny', category: 'Ropa', description: 'Compra almacén', amount: 145000 },
    { date: '2026-07-28', person: 'Compartido', category: 'Alimentación', description: 'Supermercado reposición', amount: 161657 },
    { date: '2026-07-29', person: 'Charlie', category: 'Tecnología', description: 'Audífonos Bluetooth', amount: 89000 },
    { date: '2026-07-30', person: 'Benny', category: 'Cuidado Personal', description: 'Corte y barbería', amount: 45000 },
  ]);

  // 4. Deudas
  console.log('4. Registrando deudas...');
  await sendRequest('/rest/v1/debts', 'POST', [
    { name: 'Hipoteca Apartamento', person: 'Compartido', start_date: '2026-07-01', original_amount: 80000000, current_balance: 64500000, monthly_payment: 700000, annual_interest_rate: 8.5, color: '#3B82F6' },
    { name: 'Crédito Vehículo', person: 'Benny', start_date: '2026-07-01', original_amount: 22000000, current_balance: 14200000, monthly_payment: 450000, annual_interest_rate: 10.2, color: '#F59E0B' },
    { name: 'Tarjeta de Crédito', person: 'Charlie', start_date: '2026-07-01', original_amount: 5000000, current_balance: 3800000, monthly_payment: 500000, annual_interest_rate: 24.0, color: '#EF4444' },
    { name: 'Préstamo Personal', person: 'Charlie', start_date: '2026-07-01', original_amount: 8000000, current_balance: 5200000, monthly_payment: 350000, annual_interest_rate: 15.5, color: '#10B981' },
  ]);

  console.log('✅ Base de datos de PRUEBAS poblada exitosamente.');
}

main().catch((err) => {
  console.error('❌ Error al poblar base de pruebas:', err.message);
  process.exit(1);
});
