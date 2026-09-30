/**
 * ==============================================================================
 * EXPENSES-HOME: Sincronizador Integral de Alertas de Bancolombia
 * ==============================================================================
 * Este script de Google Apps Script lee los correos de alertas de Bancolombia
 * en tu cuenta de Gmail, clasifica el tipo de transacción y registra:
 *
 * 1. 🛒 GASTOS DIARIOS (public.expenses):
 *    - Compras con Tarjeta Débito
 *    - Compras con Tarjetas de Crédito Personales
 *    - Pagos por PSE (servicios públicos, compras online)
 *    - Transferencias salientes
 * 
 * 2. 💳 TC COMPARTIDA (public.tc_expenses):
 *    - Compras realizadas con la(s) Tarjeta(s) Compartida(s)
 * 
 * 3. 💵 INGRESOS (public.incomes):
 *    - Transferencias recibidas
 *    - Abonos o pagos de Nómina / Salario
 *    - Consignaciones en cuenta
 *
 * 4. 📉 DEUDAS / CRÉDITOS:
 *    - Pagos de cuota o abonos a créditos (categorizados como 'Deudas')
 * ==============================================================================
 */

// ==============================================================================
// 1. CONFIGURACIÓN PERSONALIZADA
// ==============================================================================
const CONFIG = {
  // URL de tu proyecto de Supabase (ej: 'https://zmechahctplsnnauxvju.supabase.co')
  SUPABASE_URL: 'https://zmechahctplsnnauxvju.supabase.co',

  // Llave anónima pública de Supabase
  SUPABASE_ANON_KEY: 'TU_SUPABASE_ANON_KEY',

  // Persona a la que pertenece esta cuenta de Gmail ('Charlie' o 'Benny')
  PERSON: 'Charlie',

  // Últimos 4 dígitos de la(s) Tarjeta(s) de Crédito Compartida(s)
  // Si la compra coincide con estos dígitos, se envía a 'tc_expenses'
  SHARED_TC_DIGITS: ['1234'], 

  // Etiqueta de Gmail para marcar correos ya procesados y no duplicar
  LABEL_PROCESSED: 'ExpensesHome/Procesado',
  LABEL_ERROR: 'ExpensesHome/Error',

  // Remitente oficial de Bancolombia
  BANCOLOMBIA_SENDER: 'alertasynotificaciones@notificacionesbancolombia.com',
};

// ==============================================================================
// 2. REGLAS DE CATEGORIZACIÓN INTELIGENTE (15 Categorías Oficiales de Gastos)
// ==============================================================================
const CATEGORY_KEYWORDS = {
  'Deudas': [
    'pago de credito', 'pago credito', 'abono a credito', 'cuota hipoteca',
    'cuota vehiculo', 'credito consumo', 'sufi'
  ],
  'Mercado': [
    'exito', 'carulla', 'd1', 'ara', 'jumbo', 'metro', 'olimpica', 'olympica',
    'alkosto', 'euro', 'fruver', 'zapatoca', 'surtimax', 'pricesmart', 'colsubsidio',
    'plaza de mercado', 'supermercado'
  ],
  'Entretenimiento/salidas': [
    'cine', 'cine colombia', 'cinemark', 'procinal', 'crepes', 'el corral', 'corral',
    'frisby', 'mcdonalds', 'starbucks', 'juan valdez', 'tostao', 'kokoriko', 'archies',
    'wok', 'il forno', 'pub', 'cerveza', 'bbc', 'restaurante', 'cafe', 'bar', 'gastro',
    'pizzeria', 'hamburguesas', 'sandwich'
  ],
  'Transporte': [
    'uber', 'didi', 'cabify', 'indrive', 'beat', 'taxi', 'peaje', 'flypass',
    'facilpass', 'copetran', 'texaco', 'esso', 'mobil', 'terpel', 'primax',
    'gasolina', 'estacion de servicio', 'parqueadero', 'transmilenio', 'metro'
  ],
  'Servicios públicos': [
    'enel', 'codensa', 'epm', 'vanti', 'gas natural', 'acueducto', 'etb',
    'claro', 'tigo', 'movistar', 'emcali', 'aseo', 'energia'
  ],
  'Suscripciones': [
    'netflix', 'spotify', 'apple', 'google', 'prime video', 'amazon prime',
    'hbo', 'max', 'disney', 'youtube', 'chatgpt', 'openai', 'playstation',
    'xbox', 'patreon', 'github'
  ],
  'Salud': [
    'drogueria', 'farmacia', 'cruz verde', 'la rebaja', 'pasteur', 'colsubsidio drogueria',
    'eps', 'sanitas', 'colsanitas', 'sura', 'odontologia', 'clinica', 'optica', 'laboratorio'
  ],
  'Hogar': [
    'homecenter', 'easy', 'sodimac', 'ikea', 'panamericana', 'vidrios', 'ferreteria',
    'decoracion', 'muebles'
  ],
  'Compras': [
    'falabella', 'zara', 'bershka', 'pull and bear', 'stradivarius', 'mango',
    'koaj', 'adidas', 'nike', 'mercadolibre', 'mercado libre', 'amazon', 'shein',
    'arturo calle', 'velez', 'tennis', 'studio f'
  ],
  'Viajes': [
    'avianca', 'latam', 'wingo', 'booking', 'airbnb', 'despegar', 'hotel', 'aeropuerto'
  ],
  'Educación': [
    'universidad', 'colegio', 'coursera', 'udemy', 'platzi', 'libreria', 'curso'
  ],
};

/**
 * Función principal que busca correos no procesados y los sincroniza
 */
function syncBancolombiaEmails() {
  const query = `from:${CONFIG.BANCOLOMBIA_SENDER} -label:${CONFIG.LABEL_PROCESSED}`;
  const threads = GmailApp.search(query, 0, 25);

  if (threads.length === 0) {
    Logger.log('No se encontraron correos nuevos de Bancolombia para procesar.');
    return;
  }

  const processedLabel = getOrCreateLabel(CONFIG.LABEL_PROCESSED);
  const errorLabel = getOrCreateLabel(CONFIG.LABEL_ERROR);

  for (const thread of threads) {
    const messages = thread.getMessages();
    for (const message of messages) {
      if (hasLabel(thread, CONFIG.LABEL_PROCESSED)) continue;

      const body = message.getPlainBody();
      const subject = message.getSubject();
      const date = message.getDate();

      try {
        const parsed = parseBancolombiaEmail(body, subject, date);

        if (parsed) {
          Logger.log(`Registro extraído [${parsed.type.toUpperCase()}]: $${parsed.amount} - ${parsed.description} (${parsed.targetTable})`);
          saveRecordToSupabase(parsed);
          thread.addLabel(processedLabel);
        } else {
          // No es un correo transaccional relevante (ej: seguridad, inicio de sesión)
          thread.addLabel(processedLabel);
        }
      } catch (err) {
        Logger.log(`Error procesando mensaje: ${err.message}`);
        thread.addLabel(errorLabel);
      }
    }
  }
}

/**
 * Parsea el texto del correo de Bancolombia y extrae datos de Gasto o Ingreso
 */
function parseBancolombiaEmail(body, subject, emailDate) {
  const cleanBody = body.replace(/\s+/g, ' ');
  const text = `${subject} ${cleanBody}`;

  // 1. Filtrar correos puramente informativos o de seguridad
  const securityPatterns = [
    /clave din[aá]mica/i,
    /ingreso a sucursal/i,
    /inicio de sesi[oó]n/i,
    /bloqueo de clave/i,
    /actualizaci[oó]n de datos/i,
    /bienvenido/i,
  ];
  for (const pat of securityPatterns) {
    if (pat.test(text)) return null;
  }

  // 2. Extraer Monto ($ 45.000,00 o $45.000)
  const amountMatch = text.match(/(?:por|valor:?)\s*\$\s*([\d\.,]+)/i) || text.match(/\$\s*([\d\.,]+)/);
  if (!amountMatch) return null;

  const rawAmount = amountMatch[1];
  const normalizedAmount = rawAmount.replace(/\./g, '').split(',')[0].replace(/[^\d]/g, '');
  const amount = Number(normalizedAmount);
  if (!amount || amount <= 0) return null;

  // 3. Extraer Fecha (YYYY-MM-DD)
  let recordDate = Utilities.formatDate(emailDate, 'America/Bogota', 'yyyy-MM-dd');
  const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch) {
    recordDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  }

  // ============================================================================
  // 4. DETECCIÓN DE INGRESOS (Salarios, Transferencias recibidas, Consignaciones)
  // ============================================================================
  const isIncome = /transferencia recibida|consignaci[oó]n|n[oó]mina|abono a su cuenta/i.test(text);
  if (isIncome) {
    let source = 'Otros';
    if (/n[oó]mina|salario/i.test(text)) {
      source = 'Salario';
    } else if (/inversi[oó]n|rendimiento|interes/i.test(text)) {
      source = 'Inversiones';
    } else if (/honorario/i.test(text)) {
      source = 'Honorarios';
    }

    let description = 'Ingreso Bancolombia';
    const senderMatch = text.match(/de\s+([A-Za-z0-9\s\.\*\-]+?)(?:\s+el|\s+a\s+la|\.|$)/i);
    if (senderMatch && senderMatch[1] && senderMatch[1].length < 40) {
      description = `De: ${cleanMerchantName(senderMatch[1].trim())}`;
    } else if (/n[oó]mina/i.test(text)) {
      description = 'Pago de Nómina';
    } else if (/transferencia/i.test(text)) {
      description = 'Transferencia recibida';
    }

    return {
      type: 'income',
      targetTable: 'incomes',
      amount,
      date: recordDate,
      person: CONFIG.PERSON,
      source,
      description,
    };
  }

  // ============================================================================
  // 5. DETECCIÓN DE GASTOS (Compras Débito/Crédito, PSE, Transferencias enviadas)
  // ============================================================================
  let description = 'Compra Bancolombia';

  // Caso A: Pago por PSE (ej: "pago por PSE a ENEL CODENSA por $...")
  const pseMatch = text.match(/PSE\s+(?:a|en)\s+([A-Za-z0-9\s\.\*\-]+?)(?:\s+por|\s+desde|\s+el)/i);
  if (pseMatch && pseMatch[1]) {
    description = cleanMerchantName(pseMatch[1].trim());
  } else {
    // Caso B: Compra en Comercio (ej: "en EXITO CALLE 80 con...", "en D1 con t.deb...")
    const enMatch = text.match(/\ben\s+([A-Za-z0-9\s\.\*\-]+?)(?:\s+con|\s+el|\s+desde|\s+por)/i);
    if (enMatch && enMatch[1]) {
      description = cleanMerchantName(enMatch[1].trim());
    } else {
      // Caso C: Transferencia enviada a otra cuenta
      const transMatch = text.match(/a\s+la\s+cuenta\s+([A-Za-z0-9\*\-]+)/i);
      if (transMatch && transMatch[1]) {
        description = `Transferencia a cta ${transMatch[1].trim()}`;
      } else if (/transferencia/i.test(text)) {
        description = 'Transferencia enviada';
      }
    }
  }

  // Detección de Tarjeta Compartida vs Tarjetas Personales
  let targetTable = 'expenses'; // Por defecto tabla general de Gastos Diarios
  let isSharedTC = false;

  const cardMatch = text.match(/(?:\*|terminada en\s*)(\d{4})/i);
  if (cardMatch && cardMatch[1]) {
    const lastDigits = cardMatch[1];
    if (CONFIG.SHARED_TC_DIGITS.includes(lastDigits)) {
      targetTable = 'tc_expenses';
      isSharedTC = true;
    }
  }

  const category = guessCategory(description, text, isSharedTC);

  return {
    type: 'expense',
    targetTable,
    amount,
    date: recordDate,
    person: CONFIG.PERSON,
    category,
    description,
  };
}

/**
 * Limpia y da formato Title Case a nombres de comercios
 */
function cleanMerchantName(name) {
  let cleaned = name.replace(/[\*\#\_\d]{4,}/g, '').trim();
  return cleaned
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Clasifica automáticamente el gasto en una de las 15 categorías oficiales
 */
function guessCategory(description, fullText, isSharedTC) {
  const combined = `${description} ${fullText}`.toLowerCase();

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        return cat;
      }
    }
  }

  return isSharedTC ? 'General' : 'Otros';
}

/**
 * Guarda el registro en la tabla correspondiente de Supabase (expenses, tc_expenses o incomes)
 */
function saveRecordToSupabase(record) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/${record.targetTable}`;
  
  let payload;
  if (record.targetTable === 'incomes') {
    payload = {
      date: record.date,
      person: record.person,
      source: record.source,
      description: record.description,
      amount: record.amount,
    };
  } else {
    // 'expenses' o 'tc_expenses'
    payload = {
      date: record.date,
      person: record.person,
      category: record.category,
      description: record.description,
      amount: record.amount,
    };
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      Prefer: 'return=representation',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();

  if (code >= 200 && code < 300) {
    Logger.log(`✅ Guardado con éxito en Supabase [${record.targetTable}]: ${response.getContentText()}`);
  } else {
    throw new Error(`Error Supabase HTTP ${code}: ${response.getContentText()}`);
  }
}

/**
 * Helper para obtener o crear una etiqueta en Gmail
 */
function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function hasLabel(thread, name) {
  const labels = thread.getLabels();
  return labels.some((l) => l.getName() === name);
}

// ==============================================================================
// 3. UTILIDADES DE PRUEBA Y AUTOMATIZACIÓN
// ==============================================================================

/**
 * Prueba simulada con varios tipos de transacciones de Bancolombia
 */
function testWithSampleEmail() {
  const samples = [
    {
      sub: 'Bancolombia: Compra con tarjeta débito',
      body: 'Bancolombia: Compra por $18.500 en D1 con t.deb *9876 el 30/09/2026. Dudas al 018000912345.',
    },
    {
      sub: 'Comprobante de pago PSE',
      body: 'Bancolombia le informa pago por PSE a ENEL CODENSA por $145.000,00 el 30/09/2026.',
    },
    {
      sub: 'Bancolombia: Transferencia recibida',
      body: 'Bancolombia le informa: Transferencia recibida por $3.500.000 de EMPRESA SA el 30/09/2026 por abono de nómina.',
    },
    {
      sub: 'Bancolombia: Compra con tarjeta de crédito compartida',
      body: 'Bancolombia le informa compra con su tarjeta *1234 por $89.000 en RESTAURANTE WOK el 30/09/2026.',
    },
  ];

  Logger.log('🧪 Iniciando pruebas de extracción...');
  for (const s of samples) {
    const res = parseBancolombiaEmail(s.body, s.sub, new Date());
    Logger.log(`--------------------------------------------------`);
    Logger.log(`Tipo: ${res.type.toUpperCase()} -> Tabla: ${res.targetTable}`);
    Logger.log(`Detalle: $${res.amount.toLocaleString()} | ${res.description} | Persona: ${res.person}`);
    if (res.category) Logger.log(`Categoría: ${res.category}`);
    if (res.source) Logger.log(`Fuente ingreso: ${res.source}`);
  }
}

/**
 * Ejecuta esta función UNA SOLA VEZ para instalar el disparador automático cada 10 minutos
 */
function installTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'syncBancolombiaEmails') {
      ScriptApp.deleteTrigger(t);
    }
  }

  ScriptApp.newTrigger('syncBancolombiaEmails')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('✅ Disparador instalado: Se ejecutará automáticamente cada 10 minutos.');
}
