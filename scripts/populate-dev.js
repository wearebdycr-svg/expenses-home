const https = require('https');

const devUrl = process.argv[2] || process.env.DEV_SUPABASE_URL;
const devKey = process.argv[3] || process.env.DEV_SUPABASE_ANON_KEY;

if (!devUrl || !devKey) {
  console.error('Uso: node scripts/populate-dev.js <DEV_SUPABASE_URL> <DEV_SUPABASE_ANON_KEY>');
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

async function main() {
  console.log(`🚀 Poblando base de datos de pruebas en: ${hostname}...`);

  // 0. Limpieza previa para evitar duplicados en la base de pruebas
  console.log('0. Limpiando tablas de prueba en DEV...');
  try {
    await sendRequest('/rest/v1/tc_expenses?id=not.is.null', 'DELETE');
    await sendRequest('/rest/v1/expenses?id=not.is.null', 'DELETE');
    await sendRequest('/rest/v1/debts?id=not.is.null', 'DELETE');
    await sendRequest('/rest/v1/incomes?id=not.is.null', 'DELETE');
    console.log('   Tablas limpiadas correctamente.');
  } catch (err) {
    console.log('   (Aviso al limpiar tablas:', err.message, ')');
  }

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

  // 3. Gastos Diarios (Personales de Benny y Charlie)
  console.log('3. Registrando gastos diarios...');
  await sendRequest('/rest/v1/expenses', 'POST', [
    { date: '2026-07-09', person: 'Charlie', category: 'Entretenimiento/salidas', description: 'Cena Sushi', amount: 90000 },
    { date: '2026-07-10', person: 'Benny', category: 'Mercado', description: 'Mercado mensual Éxito', amount: 200000 },
    { date: '2026-07-12', person: 'Charlie', category: 'Transporte', description: 'Gasolina vehículo', amount: 150000 },
    { date: '2026-07-15', person: 'Benny', category: 'Salud', description: 'Medicamentos Farmacia', amount: 75000 },
    { date: '2026-07-22', person: 'Charlie', category: 'Entretenimiento/salidas', description: 'Almuerzo familiar', amount: 120000 },
    { date: '2026-07-25', person: 'Benny', category: 'Entretenimiento/salidas', description: 'Boletas de Cine', amount: 28216 },
    { date: '2026-07-27', person: 'Benny', category: 'Compras', description: 'Compra almacén', amount: 145000 },
    { date: '2026-07-29', person: 'Charlie', category: 'Compras', description: 'Audífonos Bluetooth', amount: 89000 },
    { date: '2026-07-30', person: 'Benny', category: 'Salud', description: 'Corte y barbería', amount: 45000 },
  ]);

  // 4. Deudas
  console.log('4. Registrando deudas...');
  await sendRequest('/rest/v1/debts', 'POST', [
    { name: 'Hipoteca Apartamento', person: 'Compartido', start_date: '2026-07-01', original_amount: 80000000, current_balance: 64500000, monthly_payment: 700000, annual_interest_rate: 8.5, color: '#3B82F6' },
    { name: 'Crédito Vehículo', person: 'Benny', start_date: '2026-07-01', original_amount: 22000000, current_balance: 14200000, monthly_payment: 450000, annual_interest_rate: 10.2, color: '#F59E0B' },
    { name: 'Tarjeta de Crédito', person: 'Charlie', start_date: '2026-07-01', original_amount: 5000000, current_balance: 3800000, monthly_payment: 500000, annual_interest_rate: 24.0, color: '#EF4444' },
    { name: 'Préstamo Personal', person: 'Charlie', start_date: '2026-07-01', original_amount: 8000000, current_balance: 5200000, monthly_payment: 350000, annual_interest_rate: 15.5, color: '#10B981' },
  ]);

  // 5. Consumos TC Compartida (incluyendo los compartidos del hogar)
  console.log('5. Registrando consumos de TC compartida...');
  try {
    await sendRequest('/rest/v1/tc_expenses', 'POST', [
      { date: '2026-07-04', person: 'Benny', description: 'Tiquetes Aéreos Vacaciones', amount: 650000, category: 'Viajes' },
      { date: '2026-07-05', person: 'Compartido', description: 'Arriendo apartamento', amount: 1800000, category: 'Hogar' },
      { date: '2026-07-08', person: 'Compartido', description: 'Servicios públicos (Agua, Luz, Gas)', amount: 320000, category: 'Servicios públicos' },
      { date: '2026-07-11', person: 'Charlie', description: 'Cena Aniversario Restaurante', amount: 220000, category: 'Entretenimiento/salidas' },
      { date: '2026-07-16', person: 'Compartido', description: 'Compra Smart TV Sala', amount: 1400000, category: 'Compras' },
      { date: '2026-07-18', person: 'Compartido', description: 'Internet fibra óptica', amount: 110000, category: 'Servicios públicos' },
      { date: '2026-07-24', person: 'Benny', description: 'Mercado Mayorista Alkosto', amount: 380000, category: 'Mercado' },
      { date: '2026-07-28', person: 'Compartido', description: 'Supermercado reposición', amount: 161657, category: 'Mercado' },
    ]);
  } catch (err) {
    console.log('   (Error registrando consumos TC:', err.message, ')');
  }

  console.log('6. Registrando abono de conciliación en gastos diarios...');
  try {
    await sendRequest('/rest/v1/expenses', 'POST', [
      { date: '2026-07-26', person: 'Charlie', category: 'TC-compartida', description: 'Abono Cuota TC Compartida Bancolombia', amount: 1000000 },
    ]);
  } catch (err) {
    console.log('   (Abono no se pudo registrar:', err.message, ')');
  }

  console.log('✅ Base de datos de PRUEBAS poblada exitosamente.');
}

main().catch((err) => {
  console.error('❌ Error al poblar base de pruebas:', err.message);
  process.exit(1);
});
