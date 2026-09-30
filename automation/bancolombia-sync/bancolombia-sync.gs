/**
 * ==============================================================================
 * EXPENSES-HOME: Sincronizador Automático de Alertas de Bancolombia
 * ==============================================================================
 * Este script de Google Apps Script lee los correos de alertas de Bancolombia
 * en tu cuenta de Gmail, extrae el monto, comercio/descripción y fecha,
 * clasifica la categoría automáticamente e inserta el gasto en Supabase.
 *
 * Soporta:
 * - Compras con Tarjeta de Crédito
 * - Compras con Tarjeta Débito
 * - Pagos por PSE
 * - Transferencias salientes
 * - Detección automática de Tarjeta Compartida (hacia public.tc_expenses)
 * - Detección automática de Gastos Diarios (hacia public.expenses)
 * ==============================================================================
 */

// ==============================================================================
// 1. CONFIGURACIÓN PERSONALIZADA (Ajusta estos valores)
// ==============================================================================
const CONFIG = {
  // URL de tu proyecto de Supabase (ej: 'https://zmechahctplsnnauxvju.supabase.co')
  SUPABASE_URL: 'https://zmechahctplsnnauxvju.supabase.co',

  // Llave anónima pública de Supabase
  SUPABASE_ANON_KEY: 'TU_SUPABASE_ANON_KEY',

  // Persona a la que pertenece esta cuenta de Gmail ('Benny' o 'Charlie')
  PERSON: 'Charlie',

  // Últimos 4 dígitos de la(s) Tarjeta(s) de Crédito Compartida(s)
  // Si la compra fue con una de estas tarjetas, se registra en 'tc_expenses'
  SHARED_TC_DIGITS: ['1234'], 

  // Etiqueta de Gmail para marcar correos ya procesados y no duplicar
  LABEL_PROCESSED: 'ExpensesHome/Procesado',
  LABEL_ERROR: 'ExpensesHome/Error',

  // Remitente oficial de Bancolombia
  BANCOLOMBIA_SENDER: 'alertasynotificaciones@notificacionesbancolombia.com',
};

// ==============================================================================
// 2. REGLAS DE CATEGORIZACIÓN INTELIGENTE (15 Categorías Oficiales)
// ==============================================================================
const CATEGORY_KEYWORDS = {
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
  const threads = GmailApp.search(query, 0, 20);

  if (threads.length === 0) {
    Logger.log('No se encontraron correos nuevos de Bancolombia para procesar.');
    return;
  }

  const processedLabel = getOrCreateLabel(CONFIG.LABEL_PROCESSED);
  const errorLabel = getOrCreateLabel(CONFIG.LABEL_ERROR);

  for (const thread of threads) {
    const messages = thread.getMessages();
    for (const message of messages) {
      // Ignorar si el mensaje individual ya fue marcado
      if (hasLabel(thread, CONFIG.LABEL_PROCESSED)) continue;

      const body = message.getPlainBody();
      const subject = message.getSubject();
      const date = message.getDate();

      try {
        const parsed = parseBancolombiaEmail(body, subject, date);

        if (parsed) {
          Logger.log(`Gasto extraído: $${parsed.amount} en ${parsed.description} (${parsed.targetTable})`);
          saveExpenseToSupabase(parsed);
          thread.addLabel(processedLabel);
        } else {
          // No es un correo de compra/gasto (ej: inicio de sesión, clave dinámica, etc.)
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
 * Parsea el texto del correo de Bancolombia y extrae los datos clave
 */
function parseBancolombiaEmail(body, subject, emailDate) {
  const cleanBody = body.replace(/\s+/g, ' ');
  const text = `${subject} ${cleanBody}`;

  // 1. Filtrar si es un correo que no representa egreso de dinero
  const ignorePatterns = [
    /transferencia recibida/i,
    /consignaci[oó]n/i,
    /clave din[aá]mica/i,
    /ingreso a sucursal/i,
    /inicio de sesi[oó]n/i,
    /bienvenido/i,
  ];
  for (const pat of ignorePatterns) {
    if (pat.test(text)) return null;
  }

  // 2. Extraer Monto ($ 45.000,00 o $45.000)
  // Formatos Bancolombia: "por $45.000,00", "por $ 120.000", "Valor: $50.000"
  const amountMatch = text.match(/(?:por|valor:?)\s*\$\s*([\d\.,]+)/i) || text.match(/\$\s*([\d\.,]+)/);
  if (!amountMatch) return null;

  const rawAmount = amountMatch[1];
  // Convertir formato colombiano (puntos de miles, coma de decimales): 45.000,00 -> 45000
  const normalizedAmount = rawAmount.replace(/\./g, '').split(',')[0].replace(/[^\d]/g, '');
  const amount = Number(normalizedAmount);
  if (!amount || amount <= 0) return null;

  // 3. Extraer Fecha (YYYY-MM-DD)
  // Buscar en el texto o usar la fecha del email
  let expenseDate = Utilities.formatDate(emailDate, 'America/Bogota', 'yyyy-MM-dd');
  const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch) {
    expenseDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  }

  // 4. Extraer Comercio o Descripción
  let description = 'Compra Bancolombia';
  
  // Caso A: Pago PSE (ej: "pago por PSE a ENEL CODENSA por $...")
  const pseMatch = text.match(/PSE\s+(?:a|en)\s+([A-Za-z0-9\s\.\*\-]+?)(?:\s+por|\s+desde|\s+el)/i);
  if (pseMatch && pseMatch[1]) {
    description = cleanMerchantName(pseMatch[1].trim());
  } else {
    // Caso B: Compra en Comercio (ej: "en EXITO CALLE 80 con...", "en D1 con t.deb...")
    const enMatch = text.match(/\ben\s+([A-Za-z0-9\s\.\*\-]+?)(?:\s+con|\s+el|\s+desde|\s+por)/i);
    if (enMatch && enMatch[1]) {
      description = cleanMerchantName(enMatch[1].trim());
    } else {
      // Caso C: Transferencia enviada
      const transMatch = text.match(/a\s+la\s+cuenta\s+([A-Za-z0-9\*\-]+)/i);
      if (transMatch && transMatch[1]) {
        description = `Transferencia a cta ${transMatch[1].trim()}`;
      } else if (/transferencia/i.test(text)) {
        description = 'Transferencia enviada';
      }
    }
  }

  // 5. Detectar si fue con Tarjeta Compartida o Tarjeta Personal
  let targetTable = 'expenses'; // Por defecto tabla general
  let isSharedTC = false;

  const cardMatch = text.match(/(?:\*|terminada en\s*)(\d{4})/i);
  if (cardMatch && cardMatch[1]) {
    const lastDigits = cardMatch[1];
    if (CONFIG.SHARED_TC_DIGITS.includes(lastDigits)) {
      targetTable = 'tc_expenses';
      isSharedTC = true;
    }
  }

  // 6. Asignar Categoría Automática
  const category = guessCategory(description, text, isSharedTC);

  return {
    amount,
    date: expenseDate,
    description,
    category,
    person: CONFIG.PERSON,
    targetTable,
  };
}

/**
 * Limpia y formatea nombres de comercios de Bancolombia (quita códigos raros y mayúsculas sostenidas)
 */
function cleanMerchantName(name) {
  let cleaned = name.replace(/[\*\#\_\d]{4,}/g, '').trim();
  // Capitalizar cada palabra (Title Case)
  return cleaned
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Clasifica el gasto en una de las categorías del sistema
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
 * Envía el registro de gasto a la API REST de Supabase
 */
function saveExpenseToSupabase(expense) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/${expense.targetTable}`;
  
  const payload = {
    date: expense.date,
    person: expense.person,
    category: expense.category,
    description: expense.description,
    amount: expense.amount,
  };

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
    Logger.log(`✅ Guardado con éxito en Supabase (${expense.targetTable}): ${response.getContentText()}`);
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
 * Prueba manual sin enviar a Supabase para verificar que el parser funcione
 */
function testWithSampleEmail() {
  const sampleEmail = `
    Bancolombia le informa compra con su tarjeta de credito *1234 por $85.500,00 en EXITO CALLE 80 el 30/09/2026 14:35. Inquietudes al 018000912345.
  `;
  const subject = 'Bancolombia: Compra con tarjeta de crédito';
  const parsed = parseBancolombiaEmail(sampleEmail, subject, new Date());

  Logger.log('Resultado de la prueba:');
  Logger.log(JSON.stringify(parsed, null, 2));
}

/**
 * Ejecuta esta función UNA SOLA VEZ para instalar el disparador automático cada 10 minutos
 */
function installTrigger() {
  // Eliminar disparadores previos si existen
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'syncBancolombiaEmails') {
      ScriptApp.deleteTrigger(t);
    }
  }

  // Crear disparador cada 10 minutos
  ScriptApp.newTrigger('syncBancolombiaEmails')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('✅ Disparador instalado: Se ejecutará automáticamente cada 10 minutos.');
}
