# 🤖 Automatización: Sincronización Automática Bancolombia -> Expenses-Home

Este módulo permite leer automáticamente los correos de alertas de compras y pagos de **Bancolombia** desde tu cuenta de Gmail, extraer los datos del gasto (monto, comercio, fecha, tarjeta), categorizarlo con inteligencia de negocio y registrarlo directamente en **Supabase**.

Gracias a **Supabase Realtime**, cualquier gasto que hagas en la calle aparecerá automáticamente en la pantalla de la aplicación sin que tengas que ingresar nada manual.

---

## ⚡ Características

* **Detecta automáticamente**:
  * Compras con Tarjeta de Crédito física o virtual.
  * Compras con Tarjeta Débito.
  * Pagos por PSE (servicios públicos, compras online).
  * Transferencias salientes.
* **Separación inteligente de Tarjetas**:
  * Si la compra se hizo con la **Tarjeta de Crédito Compartida** (identificada por sus últimos 4 dígitos), se guarda directamente en la tabla `tc_expenses` de la TC Compartida.
  * Si fue con tarjeta personal, débito o transferencia, se guarda en `expenses` bajo el nombre de la persona (`Charlie` o `Benny`).
* **Categorización automática**: Clasifica comercios colombianos frecuentes a las 15 categorías oficiales (ej. *Éxito, Carulla, D1* $\to$ `Mercado`; *Uber, DiDi, Texaco* $\to$ `Transporte`; *Netflix, Spotify* $\to$ `Suscripciones`; *Enel, EPM, Claro* $\to$ `Servicios públicos`).
* **Manejo de hilos agrupados de Gmail**: Procesa cada correo por su **ID único de mensaje**, evitando que compras sucesivas se pierdan cuando Gmail agrupa varios correos de Bancolombia en una sola conversación.
* **Frecuencia configurable y Modo Nocturno**: Ajusta el intervalo de ejecución entre 5 min, 10 min, 15 min, 30 min o 1 hora (`TRIGGER_EVERY_MINUTES`), con opción de suspender revisiones en la noche (`NIGHT_MODE_SAVINGS`) para optimizar cuotas.
* **Anti-duplicación multinivel**: Valida por ID de mensaje procesado y por coincidencia exacta en Supabase (monto, fecha, comercio y persona) para no duplicar ningún registro.
* **100% Gratuito y sin servidores**: Corre en los servidores de Google Apps Script dentro de tu propia cuenta de Gmail.

---

## 🚀 Guía de Instalación Paso a Paso (5 Minutos)

### Paso 1: Abrir Google Apps Script
1. Con tu sesión de Gmail abierta donde recibes las alertas de Bancolombia, ingresa a:  
   👉 [https://script.google.com/home/start](https://script.google.com/home/start)
2. Haz clic en el botón superior izquierdo **"+ Nuevo proyecto"**.
3. En la parte superior, cámbiale el nombre de *"Proyecto sin título"* a **`Expenses Home - Bancolombia Sync`**.

---

### Paso 2: Pegar el Código
1. En el editor de código, borra cualquier texto predeterminado que haya en el archivo `Código.gs`.
2. Copia todo el contenido del archivo [`bancolombia-sync.gs`](./bancolombia-sync.gs) de esta carpeta y pégalo en el editor de Google.

---

### Paso 3: Configurar tus Credenciales
En las primeras líneas del archivo encontrarás la sección `CONFIG`:

```javascript
const CONFIG = {
  // 1. URL de tu proyecto de Supabase (Producción o Dev)
  SUPABASE_URL: 'https://TU_PROYECTO.supabase.co',

  // 2. Llave anónima pública de Supabase
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',

  // 3. Persona de esta cuenta de Gmail ('Charlie' o 'Benny')
  PERSON: 'Charlie',

  // 4. Últimos 4 dígitos de la Tarjeta de Crédito Compartida (ej: '0066' Bancolombia)
  // Si la compra fue con esta tarjeta, irá a TC Compartida; si no, a Gastos Diarios
  SHARED_TC_DIGITS: ['0066'], 

  LABEL_PROCESSED: 'ExpensesHome/Procesado',
  LABEL_ERROR: 'ExpensesHome/Error',
  BANCOLOMBIA_SENDER: 'alertasynotificaciones@notificacionesbancolombia.com',

  // 5. Frecuencia de escaneo: 5, 10, 15, 30 o 60 (1 hora)
  TRIGGER_EVERY_MINUTES: 10,

  // 6. Modo nocturno: pausa escaneos entre 11 PM y 6 AM para ahorrar cuota
  NIGHT_MODE_SAVINGS: false, // Cambia a true si deseas activarlo
  NIGHT_START_HOUR: 23,
  NIGHT_END_HOUR: 6,
};
```

* Guarda los cambios presionando `Ctrl + S` (o `Cmd + S` en Mac).

---

### Paso 4: Probar que funcione
1. En la barra superior del editor de Google Apps Script, en el selector de funciones, elige **`testWithSampleEmail`**.
2. Haz clic en **Ejecutar**.
3. En la parte inferior se abrirá el "Registro de ejecución" mostrando la extracción simulada de un gasto del Éxito con monto, categoría y tarjeta.

---

### Paso 5: Activar la Sincronización Automática
1. En el mismo selector de funciones, elige **`installTrigger`**.
2. Haz clic en **Ejecutar**.
3. Google te pedirá autorizar permisos para que el script pueda leer tus correos y conectar a internet (pantalla habitual de *"Google no ha verificado esta aplicación"* $\to$ clic en *"Configuración avanzada"* $\to$ *"Ir a Expenses Home (no seguro)"* $\to$ *"Permitir"*).
4. Verás en el registro:  
   `✅ Disparador instalado: Se ejecutará automáticamente cada 10 minutos.`

¡Listo! A partir de este momento, cada vez que hagas un pago o compra con Bancolombia, tu Gmail recibirá el correo y en los próximos minutos el script lo registrará automáticamente en tu aplicación.

---

## 👥 ¿Cómo configurarlo para Benny y Charlie al tiempo?
* **Charlie**: Sigue los pasos anteriores en su cuenta de Gmail con `PERSON: 'Charlie'`.
* **Benny**: Sigue los mismos pasos en su cuenta de Gmail con `PERSON: 'Benny'`.
* Ambos usan la misma `SUPABASE_URL` y `SUPABASE_ANON_KEY` y los mismos dígitos de la tarjeta compartida si ambos la usan.
