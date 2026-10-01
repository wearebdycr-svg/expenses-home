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

  // Límite de antigüedad para buscar correos en Gmail (ej: '2d' = últimos 2 días)
  // Evita que el script procese correos históricos de semanas, meses o años pasados
  MAX_DAYS_AGO: '2d',

  // Dominio o remitente oficial de Bancolombia (cubre subdominios como ayn. y an.)
  BANCOLOMBIA_SENDER: 'notificacionesbancolombia.com',
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
  const query = `from:${CONFIG.BANCOLOMBIA_SENDER} -label:${CONFIG.LABEL_PROCESSED} newer_than:${CONFIG.MAX_DAYS_AGO}`;
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
          // Filtro de seguridad: ignorar y marcar transacciones con más de 7 días de antigüedad
          const txDate = new Date(parsed.date + 'T00:00:00');
          const now = new Date();
          const diffDays = (now - txDate) / (1000 * 60 * 60 * 24);
          if (diffDays > 7) {
            Logger.log(`⏭️ Omitiendo transacción antigua (${parsed.date}): ${parsed.description}`);
            thread.addLabel(processedLabel);
            continue;
          }

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

  // 2. Extraer Monto ($ o COP, ej: COP34.320,00, $34.320,00, COP 50.000, etc.)
  const amountMatch = text.match(/(?:\$|COP)\s*([\d\.,]+)/i) ||
                      text.match(/(?:por|valor:?|compraste|pagaste|transferiste)\s*(?:\$|COP)?\s*([\d\.,]+)/i);
  if (!amountMatch) return null;

  const rawAmount = amountMatch[1];
  const amount = parseAmount(rawAmount);
  if (!amount || amount <= 0) return null;

  // 3. Extraer Fecha (YYYY-MM-DD)
  let recordDate = Utilities.formatDate(emailDate, 'America/Bogota', 'yyyy-MM-dd');
  const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch) {
    recordDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  }

  // ============================================================================
  // 4. DETECCIÓN DE INGRESOS (Nómina, Salarios, Transferencias recibidas, Consignaciones)
  // ============================================================================
  const isIncome = /recibiste|transferencia recibida|consignaci[oó]n|abono a su cuenta|abono de n[oó]mina/i.test(text);
  if (isIncome) {
    let source = 'Otros';
    if (/n[oó]mina|salario|sueldo/i.test(text)) {
      source = 'Salario';
    } else if (/inversi[oó]n|rendimiento|interes/i.test(text)) {
      source = 'Inversiones';
    } else if (/honorario|freelance/i.test(text)) {
      source = 'Freelance';
    } else if (/arriendo|alquiler/i.test(text)) {
      source = 'Arriendo';
    }

    let description = 'Ingreso Bancolombia';
    const pagoDeMatch = text.match(/recibiste\s+(?:un\s+)?pago\s+(?:de\s+)?([A-Za-z0-9\s\.\*\-]+?)(?:\s+por|\s+en\s+tu|\.|$)/i);
    const deMatch = text.match(/(?:de|desde)\s+([A-Za-z0-9\s\.\*\-]+?)(?:\s+el|\s+a\s+la|\s+por|\.|$)/i);

    if (pagoDeMatch && pagoDeMatch[1] && pagoDeMatch[1].trim().length < 60) {
      description = cleanMerchantName(pagoDeMatch[1].trim());
    } else if (deMatch && deMatch[1] && deMatch[1].trim().length < 60) {
      description = `De: ${cleanMerchantName(deMatch[1].trim())}`;
    } else if (/n[oó]mina/i.test(text)) {
      description = 'Pago de Nómina';
    } else {
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
  // 5. DETECCIÓN DE GASTOS (Compras Débito/Crédito, Pagos, PSE, Transferencias enviadas)
  // ============================================================================
  let description = 'Compra Bancolombia';

  // Caso A: Pagaste a / Transferiste a (ej: "Pagaste $9,111.92 a NU Compania de Financiamiento desde tu producto...")
  const pagasteMatch = text.match(/(?:pagaste|transferiste)\s+(?:\$\s*[\d\.,]+\s+)?a\s+([A-Za-z0-9\s\.\*\-]+?)(?:\s+desde|\s+el|\.|$)/i);
  // Caso B: Pago por PSE (ej: "pago por PSE a ENEL CODENSA por $...")
  const pseMatch = text.match(/PSE\s+(?:a|en)\s+([A-Za-z0-9\s\.\*\-]+?)(?:\s+por|\s+desde|\s+el)/i);
  // Caso C: Compra en Comercio (ej: "en EXITO CALLE 80 con...", "en D1 con t.deb...")
  const enMatch = text.match(/\ben\s+([A-Za-z0-9\s\.\*\-]+?)(?:\s+con|\s+el|\s+desde|\s+por)/i);
  // Caso D: Transferencia enviada a otra cuenta
  const transMatch = text.match(/a\s+la\s+cuenta\s+([A-Za-z0-9\*\-]+)/i);

  if (pagasteMatch && pagasteMatch[1]) {
    description = cleanMerchantName(pagasteMatch[1].trim());
  } else if (pseMatch && pseMatch[1]) {
    description = cleanMerchantName(pseMatch[1].trim());
  } else if (enMatch && enMatch[1]) {
    description = cleanMerchantName(enMatch[1].trim());
  } else if (transMatch && transMatch[1]) {
    description = `Transferencia a cta ${transMatch[1].trim()}`;
  } else if (/transferencia/i.test(text)) {
    description = 'Transferencia enviada';
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

  // Clasificar categoría evaluando SOLO el comercio/destinatario para evitar falsos positivos
  const category = guessCategory(description, isSharedTC);
  const person = isSharedTC ? 'Compartido' : CONFIG.PERSON;

  return {
    type: 'expense',
    targetTable,
    amount,
    date: recordDate,
    person,
    category,
    description,
  };
}

/**
 * Limpia y da formato Title Case a nombres de comercios y destinatarios
 */
function cleanMerchantName(name) {
  let cleaned = name.replace(/[\*\#\_]{2,}/g, '').trim();
  const keepUpper = ['SAS', 'SA', 'LTDA', 'PSE', 'NU', 'AFC', 'EPS', 'D1'];
  const lowerWords = ['de', 'la', 'el', 'los', 'las', 'en', 'a', 'por', 'y', 'del'];

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (keepUpper.includes(upper)) return upper;
      if (lowerWords.includes(word.toLowerCase())) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Parsea de forma robusta cualquier formato numérico de moneda (Bancolombia)
 * Maneja miles con coma o punto, y decimales con punto o coma.
 * Ejemplos:
 * "100,000.00" -> 100000
 * "100.000,00" -> 100000
 * "100,000"    -> 100000
 * "100.000"    -> 100000
 * "3.500.000"  -> 3500000
 * "3,500,000"  -> 3500000
 * "18.500"     -> 18500
 * "60,000"     -> 60000
 */
function parseAmount(rawStr) {
  if (!rawStr) return 0;
  // Conservar solo dígitos, puntos y comas
  const str = rawStr.replace(/[^\d,\.]/g, '').trim();
  if (!str) return 0;

  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');

  // Caso 1: Tiene tanto punto como coma (ej: 100,000.00 o 100.000,00)
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastDot > lastComma) {
      // El punto está al final -> el punto es decimal (ej: 100,000.00)
      const integerPart = str.substring(0, lastDot).replace(/[^\d]/g, '');
      const decimalPart = str.substring(lastDot + 1).replace(/[^\d]/g, '');
      const decVal = decimalPart ? Number(decimalPart) / Math.pow(10, decimalPart.length) : 0;
      return Math.round(Number(integerPart) + decVal);
    } else {
      // La coma está al final -> la coma es decimal (ej: 100.000,00)
      const integerPart = str.substring(0, lastComma).replace(/[^\d]/g, '');
      const decimalPart = str.substring(lastComma + 1).replace(/[^\d]/g, '');
      const decVal = decimalPart ? Number(decimalPart) / Math.pow(10, decimalPart.length) : 0;
      return Math.round(Number(integerPart) + decVal);
    }
  }

  // Caso 2: Solo punto O solo coma
  const sep = lastDot !== -1 ? '.' : (lastComma !== -1 ? ',' : null);
  if (!sep) {
    // Solo dígitos
    return Number(str);
  }

  const parts = str.split(sep);
  // Si hay más de un separador (ej: 3.500.000 o 3,500,000) -> definitivamente son separadores de miles
  if (parts.length > 2) {
    return Number(parts.join(''));
  }

  // Hay exactamente un separador: parts[0] y parts[1]
  // Si la parte derecha tiene exactamente 3 dígitos (ej: 100,000 o 60.000 o 18.500) -> en pesos colombianos son miles
  if (parts[1].length === 3) {
    return Number(parts[0] + parts[1]);
  }

  // Si tiene 1 o 2 dígitos después del separador (ej: 100000.00 o 60000,00) -> son decimales (centavos)
  if (parts[1].length <= 2) {
    const intVal = Number(parts[0]);
    const decVal = Number(parts[1]) / Math.pow(10, parts[1].length);
    return Math.round(intVal + decVal);
  }

  return Number(str.replace(/[^\d]/g, ''));
}

/**
 * Clasifica automáticamente el gasto evaluando SOLO el comercio o descripción
 * Evita falsos positivos causados por links en el pie del correo (Google Play, etc.)
 */
function guessCategory(description, isSharedTC) {
  const desc = (description || '').toLowerCase();

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      // Usar límites de palabra \b para evitar falsos positivos
      const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(desc)) {
        return cat;
      }
    }
  }

  // Si no coincide con ninguna palabra clave, asigna Otros (o General si es TC Compartida)
  return isSharedTC ? 'General' : 'Otros';
}

/**
 * Guarda el registro en la tabla correspondiente de Supabase (expenses, tc_expenses o incomes)
 */
function saveRecordToSupabase(record) {
  // 1. Verificación anti-duplicados en Supabase (idempotencia)
  const checkUrl = `${CONFIG.SUPABASE_URL}/rest/v1/${record.targetTable}?date=eq.${record.date}&person=eq.${record.person}&amount=eq.${record.amount}&select=id`;
  const checkOptions = {
    method: 'get',
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
    },
    muteHttpExceptions: true,
  };

  try {
    const checkResp = UrlFetchApp.fetch(checkUrl, checkOptions);
    if (checkResp.getResponseCode() === 200) {
      const existing = JSON.parse(checkResp.getContentText());
      if (existing && existing.length > 0) {
        Logger.log(`⚠️ Registro ya existe en Supabase [${record.targetTable}] ($${record.amount} del ${record.date}). Omitiendo inserción para evitar duplicado.`);
        return;
      }
    }
  } catch (e) {
    Logger.log(`Advertencia comprobando duplicados: ${e.message}`);
  }

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
    {
      sub: 'Alertas y Notificaciones Bancolombia',
      body: 'Bancolombia: Pagaste $9,111.92 a NU Compania de Financiamiento desde tu producto 4312 el 30/09/2026 21:06:43. ¿Dudas? Llamanos al 6045109095. Estamos cerca',
    },
    {
      sub: 'Alertas y Notificaciones Bancolombia',
      body: 'Bancolombia: Compraste COP34.320,00 en TIENDA D1 CHAPINERO con tu T.Cred *0066, el 01/10/2026 a las 08:09. Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.',
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
