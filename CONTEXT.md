# CONTEXT.md - Línea Base de Arquitectura y Auditoría Técnica

> **Proyecto:** Finanzas Hogar (`expenses-home`)  
> **Fecha de Auditoría:** 2026-11-03  
> **Rol:** Auditor de Software & Arquitecto Técnico  
> **Estado de Compilación / Tipos:** 0 errores (`tsc --noEmit`)  
> **Estado de Pruebas Unitarias:** 283/283 tests pasando (55 suites en Vitest)  
> **Estado de Calidad Estática:** 0 errores ESLint (143 advertencias registradas)

---

## 1. Stack Técnico Real

| Capa | Tecnología / Herramienta | Versión | Rol / Propósito |
| :--- | :--- | :--- | :--- |
| **Framework Web** | **Angular** | `^22.2.1` | Arquitectura Standalone, Signals reactivos, Control Flow (`@if`, `@for`, `@switch`), `OnPush`. |
| **Lenguaje & Tipos** | **TypeScript** | `~6.0.2` | Compilación estricta (`strict: true`), tipado estático, target ES2022. |
| **Móvil / Runtime Híbrido** | **Capacitor** | `^8.5.2` | Empaquetado nativo Android, Biometría nativa, Notificaciones Push & Locales, Haptics, Status Bar. |
| **Base de Datos & Auth** | **Supabase** (`@supabase/supabase-js`) | `^2.117.2` | PostgreSQL 15, Row Level Security (RLS), WebSockets Realtime y Supabase Auth. |
| **Cloud Services & Push** | **Firebase Web SDK** | `^12.19.0` | Firebase Cloud Messaging (FCM Web) y Firebase Remote Config. |
| **Backend Serverless / Crons** | **Vercel Functions** | Node.js (ESM) | Funciones en `/api`: recordatorio diario vía Cron (`cron-reminder.js`), registro de tokens FCM y despacho de notificaciones. |
| **Visualización & KPIs** | **Chart.js** & **ng2-charts** | `4.5.1` / `10.0.0` | Gráficos de barras, líneas de proyección, donuts de categorías y tendencias. |
| **Testing & Test Runner** | **Vitest** (`@angular/build:unit-test`) | `^4.0.8` / `4.1.10` | 55 archivos spec, 283 pruebas unitarias sin dependencias externas en tiempo de test. |
| **Linter & Seguridad** | **ESLint** & **eslint-plugin-security** | `10.11` / `4.2` | Reglas de Angular ESLint y análisis estático de vulnerabilidades de seguridad. |
| **Estilos & UI** | **CSS3 Nativo** | - | CSS Variables / Design Tokens, diseño Mobile First adaptado a pantallas táctiles. |

---

## 2. Estructura del Proyecto

```text
expenses-home/
├── android/                 # Proyecto nativo Gradle / Android para Capacitor
├── api/                     # Serverless functions en Vercel (Cron diario, FCM token, dispatch)
├── automation/              # Automatizaciones auxiliares del proyecto
├── public/                  # Assets estáticos (iconos, splash, manifest)
├── scripts/                 # Utilidades DevOps y generación de entorno
│   ├── set-env.js           # Generador automático de environment.ts a partir de .env
│   ├── patch-google-services.js # Inyección de credenciales Firebase Android en build
│   └── generate-android-assets.py # Generador de resoluciones de iconos Android
├── src/
│   ├── environments/        # Ambientes generados dinámicamente (DEV / PROD)
│   ├── styles.css           # Tokens globales, variables CSS y reset
│   └── app/
│       ├── core/services/   # Servicios transversales singleton (providedIn: 'root')
│       │   ├── supabase.service.ts          # Cliente Supabase (con mock transparente para tests)
│       │   ├── supabase-auth.service.ts     # Manejo de sesión JWT de Supabase
│       │   ├── auth-pin.service.ts          # Autenticación secundaria PIN / Biometría / SHA-256
│       │   ├── push-notification.service.ts # Orquestación FCM, alertas y notificaciones locales
│       │   ├── remote-config.service.ts     # Firebase Remote Config con fallback offline
│       │   ├── daily-reminder.service.ts    # Control de recordatorios diarios en cliente
│       │   ├── trm.service.ts               # Consulta y caché de TRM USD/COP
│       │   └── toast.service.ts             # Mensajería reactiva a usuario
│       ├── features/        # Módulos verticales por dominio de negocio
│       │   ├── gastos/        # Gastos diarios, filtros, desglose y tabla
│       │   ├── ingresos/      # Registro de ingresos fijos/variables y gráficas
│       │   ├── resumen/       # Dashboard ejecutivo, KPIs consolidados y balances
│       │   ├── categoria/     # Gestión de categorías y presupuestos límite
│       │   ├── gastos-fijos/  # Matriz de gastos recurrentes y modal rápido
│       │   ├── deudas/        # Motor de amortización francesa 36 meses y prepagos
│       │   ├── tc-compartida/ # Motor FIFO multi-tarjeta de crédito y división de cuotas
│       │   └── proyectos/     # Proyectos y eventos con soporte multimoneda (USD/TRM)
│       └── shared/          # Componentes y utilidades reutilizables
│           ├── ui/          # Componentes presentacionales (modal, select, badge, sidebar, etc.)
│           └── utils/       # Utilidades puras (format.utils, security.util, color)
└── supabase/                # Scripts SQL, esquemas, políticas RLS y vistas analíticas
```

---

## 3. Arquitectura y Flujo de Datos Principal

```
┌────────────────────────────────────────────────────────┐
│                      Capacitor / Web                    │
│   ┌────────────────────────────────────────────────┐   │
│   │ App Root (State: Signals + Hash Navigation)     │   │
│   └───────────────────────┬────────────────────────┘   │
│                           │                             │
│       ┌───────────────────┴───────────────────┐         │
│       ▼                                       ▼         │
│ [Capa de Seguridad]                   [Vistas / Features]
│  - SupabaseAuth (JWT)                  - Gastos / Resumen
│  - AuthPinService                      - Deudas / TC / Proy
│    (Biometría + SHA-256)               - Gastos Fijos
│       │                                       │         │
│       └───────────────────┬───────────────────┘         │
│                           ▼                             │
│              [Data Services (Signals)]                  │
│               - LocalStorage (Instant cache)            │
│               - Supabase Client (CRUD)                  │
│               - Supabase Realtime Channels (Live Sync)  │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
  [Supabase PostgreSQL]            [Push & Serverless]
   - Tablas de Negocio              - /api/notify (Vercel)
   - RLS Policies                   - FCM v1 Token Dispatch
   - Vistas (v_monthly_summary)     - Cron Reminder
```

### Principios de Flujo de Datos:
1. **Configuración de Entorno:**
   - La aplicación no lee `.env` en tiempo de ejecución en el browser. El script `scripts/set-env.js` se ejecuta en `prestart`, `prebuild` y `pretest`, inyectando `src/environments/environment.ts` con credenciales de DEV o PROD según la rama Git o bandera `--env=prod`.
2. **Navegación Sin `<router-outlet>`:**
   - El componente raíz `App` (`src/app/app.ts`) gestiona la vista activa mediante una señal reactiva `currentPage = signal<SidebarPageId>(...)`.
   - Se sincroniza bidireccionalmente con `window.location.hash` (`#gastos`, `#deudas`, etc.) y `localStorage` (`expenses_home_active_page`).
   - El botón físico de retroceso de Android es capturado por `CapApp.addListener('backButton')` para cerrar modales activos antes de navegar o salir.
3. **Estrategia Local-First + Cloud Realtime:**
   - Cada servicio de dominio (`expenses.service`, `tc.service`, `projects.service`, etc.) inicializa su estado desde `localStorage` para renderizado instantáneo sin pantallas en blanco.
   - Inmediatamente consulta la API de Supabase y suscribe un canal WebSocket (`realtime`) para sincronizar mutaciones concurrentes de otros dispositivos de la familia.
4. **Seguridad en Dos Fases:**
   - **Fase 1 (Red / Backend):** `SupabaseAuthService` valida las credenciales de Supabase.
   - **Fase 2 (Dispositivo / Frontend):** `AuthPinService` bloquea la interfaz requiriendo biometría o PIN de 4 dígitos con expiración por inactividad a los 10 minutos (política bancaria).

---

## 4. Convenciones Existentes de Código

1. **Angular Moderno:**
   - Todo componente es `standalone: true`. No existen `NgModule`.
   - Estrategia de detección de cambios obligatoria: `ChangeDetectionStrategy.OnPush`.
   - Inyección de dependencias mediante `inject(Service)` a nivel de propiedades, reservando el constructor solo para inicialización de listeners del DOM o suscripciones.
   - Preferencia estricta por Signals (`signal`, `computed`, `input`, `output`) sobre `Subject`/`BehaviorSubject` de RxJS para el estado de componentes.
2. **Modularidad CSS:**
   - Cada componente tiene su hoja de estilos `.css` local. No se importan frameworks de utilidades (Tailwind).
   - Se respetan las variables y tokens definidos en `src/styles.css` (`--bg-primary`, `--accent-primary`, etc.).
3. **Dominio de Negocio:**
   - Las entidades financieras y personas familiares están tipadas explícitamente: `ExpensePerson = 'Benny' | 'Charlie' | 'Compartido'`.
   - Manejo de monedas: Pesos colombianos (COP) por defecto; soporte de USD con cálculo dinámico según la tasa representativa del mercado (`TrmService`).
4. **Testing sin Efectos Secundarios:**
   - Los tests unitarios no dependen de red ni de servidores Supabase/Firebase reales. `SupabaseService` implementa detección de Vitest y expone un mock proxy para resolver llamadas asíncronas de manera segura.
   - Para ejecutar tests en entornos con sandbox, el comando canónico es: `HOME=/tmp ng test --watch=false`.

---

## 5. Zonas Prohibidas / Delicadas (No-Touch Zones)

Estas zonas contienen alta densidad de reglas de negocio, acoplamiento cruzado o algoritmos matemáticos críticos. **Queda prohibido modificarlas o refactorizarlas sin una batería de pruebas de regresión previa y aprobación explícita:**

| Archivo / Módulo | Líneas | Nivel de Riesgo | Motivo Técnico / Criticidad |
| :--- | :---: | :---: | :--- |
| **`tc.service.ts`**<br>`src/app/features/tc-compartida/data/tc.service.ts` | 1,112 | 🔴 **CRÍTICO** | **Motor de Amortización FIFO y Multi-Tarjeta:** Contiene `calculateAmortizedPendingDebt` que concilia consumos con abonos cronológicos, división de cuotas 50/50, parsing de etiquetas `[CARD:...]`, almacenamiento local y canales Supabase. |
| **`push-notification.service.ts`**<br>`src/app/core/services/push-notification.service.ts` | 919 | 🔴 **CRÍTICO** | **Acoplamiento Inverso y Multicanal:** Servicio de core que importa modelos de 5 features diferentes (`gastos`, `deudas`, `tc`, `ingresos`, `categoria`). Maneja tokens FCM web, permisos nativos Capacitor, y llamadas al backend Vercel. |
| **`expense-form-modal.ts`**<br>`src/app/features/gastos/components/expense-form-modal/` | 795 | 🔴 **CRÍTICO** | **Punto de Unión de Toda la Aplicación:** Orquesta la creación de gastos normales, abonos a deudas, consumos con TC, gastos de proyectos y completado de gastos fijos. Inyecta 6 servicios simultáneos. |
| **`projects.service.ts`**<br>`src/app/features/proyectos/data/projects.service.ts` | 786 | 🟠 **ALTO** | **Lógica Multimoneda y Eventos:** Gestiona presupuestos en USD/COP, conversión dinámica vía TRM, gastos de viaje/eventos y sincronización con tarjetas de crédito. |
| **`debts.service.ts`**<br>`src/app/features/deudas/data/debts.service.ts` | 641 | 🟠 **ALTO** | **Matemática Financiera (Amortización Francesa):** Proyección a 36 meses, recálculo de intereses ante abonos extraordinarios (prepagos) y generación automática de cuotas como gastos. |
| **`auth-pin.service.ts`**<br>`src/app/core/services/auth-pin.service.ts` | 636 | 🟠 **ALTO** | **Seguridad y Criptografía de Sesión:** Manejo de salts, hashes SHA-256 en Web Crypto API, bloqueo por 5 intentos fallidos, y puente nativo a huella/FaceID con Capacitor Biometrics. |
| **`scripts/set-env.js`** | 131 | 🟡 **MEDIO** | **Integridad DevOps / CI/CD:** Script que alimenta las variables de compilación de Angular en Vercel, GitLab CI y builds locales de APK. |

---

## 6. Deuda Técnica y Oportunidades Identificadas para Futuras Olas

1. **Desacoplamiento de `PushNotificationService`:**
   - Los modelos de feature deben desacoplarse del servicio central mediante un contrato o DTO unificado (`NotificationPayload`).
2. **Extracción de Utilidades Duplicadas:**
   - La función `formatCOP` se encuentra replicada en múltiples archivos de modelo (`categoria.model`, `expense.model`, `debt.model`). Debe consolidarse en `src/app/shared/utils/format.utils.ts`.
3. **División del Modal Maestro `expense-form-modal`:**
   - Extraer sub-formularios o compositores para delegar la lógica de Tarjetas de Crédito, Deudas y Proyectos a componentes especializados.
4. **Resolución de Advertencias ESLint (143 warnings):**
   - 95 ocurrencias de `@typescript-eslint/no-explicit-any` en servicios de datos y callbacks de Chart.js.
   - 12 outputs con nombres reservados por el DOM (`cancel`, `close`) que violan `@angular-eslint/no-output-native`.
   - 23 advertencias de accesibilidad (`click` sin evento de teclado acompañante en botones y modales).

---

## 7. Módulo Técnico: Alertas de Vencimiento de Gastos Fijos con Notificaciones Push

### 7.1. Modelo de Datos Canónico (Invariantes y Tipado Estricto)

Cada registro de gasto fijo debe satisfacer el siguiente contrato formal en TypeScript y su correspondiente proyección en base de datos:

```typescript
/**
 * Invariante de Dominio: Gasto Fijo con parámetros de vencimiento y alerta.
 */
export interface GastoFijoAlerta {
  readonly id: string;
  readonly nombre: string;
  readonly monto: number; // Monto esperado > 0 (COP / USD)
  readonly dia_limite_mes: number; // Entero estricto entre 1 y 31 inclusive
  readonly dias_anticipacion_alerta: number; // Entero >= 0 (ventana de disparo)
}

/**
 * Estado evaluado de alerta tras cálculo puro.
 */
export type EstadoVencimiento = 
  | 'al_dia'        // Faltan más días que los definidos en dias_anticipacion_alerta
  | 'proximo'       // Dentro de la ventana [1..dias_anticipacion_alerta]
  | 'vence_hoy'     // Exactamente 0 días restantes
  | 'vencido';      // Días restantes < 0 en el ciclo evaluado

export interface ResultadoCalculoVencimiento {
  readonly gastoId: string;
  readonly diasRestantes: number;
  readonly fechaLimiteCalculada: string; // Formato canónico ISO 'YYYY-MM-DD'
  readonly estado: EstadoVencimiento;
  readonly requiereNotificacion: boolean;
}
```

> [!IMPORTANT]
> **Reglas No Negociables del Modelo:**
> 1. `dia_limite_mes` debe ser validado como entero: `Number.isInteger(d) && d >= 1 && d <= 31`.
> 2. `dias_anticipacion_alerta` debe ser un entero no negativo: `Number.isInteger(a) && a >= 0`.
> 3. En la persistencia en Supabase/PostgreSQL, las columnas deben tiparse como `smallint` con constraints `CHECK (dia_limite_mes BETWEEN 1 AND 31)` y `CHECK (dias_anticipacion_alerta >= 0)`.

---

### 7.2. Regla de Negocio: Motor de Cálculo Puro de Vencimiento

Para prevenir discrepancias por husos horarios ambiguos, cambio de horario de verano (DST) o mutaciones colaterales en objetos `Date`:

1. **Pureza Funcional Total:**
   - La función evaluadora debe ser **pura** y **determinista**: ante las mismas entradas `(gasto, fechaReferencia)` produce idéntico resultado sin mutar el objeto original y sin efectos colaterales.
   - Prohibido invocar `new Date()` o `Date.now()` dentro del cuerpo de la función matemática; la fecha actual debe inyectarse obligatoriamente como argumento `fechaReferencia`.

2. **Normalización Temporal Canónica (Timezone-Agnostic):**
   - Las comparaciones se ejecutan exclusivamente a nivel de fecha calendario (`YYYY-MM-DD`), aislando componentes de hora, minutos, segundos y milisegundos.
   - Cálculo en tiempo civil / UTC canónico a mediodía (`12:00:00Z`) para evitar desplazamientos por límites de día en conversiones de zona local.

3. **Manejo de Meses Cortos (Clamping Rule):**
   - Si `dia_limite_mes` supera el número de días del mes en curso (ej. día 31 en febrero o abril), la fecha límite se ajusta al último día del mes correspondiente:
     $$\text{diaEfectivo} = \min(\text{dia\_limite\_mes}, \text{diasDelMes}(\text{año}, \text{mes}))$$

#### Firma Canónica de la Función Pura:
```typescript
/**
 * Calcula el estado de vencimiento de un gasto fijo de forma pura y determinista.
 *
 * @param gasto Entidad inmutable del gasto fijo.
 * @param fechaReferencia Fecha base de evaluación (Date o string 'YYYY-MM-DD').
 * @returns Resultado inmutable con días restantes, fecha límite y flag de disparo.
 */
export function calcularVencimientoGastoFijo(
  gasto: Readonly<GastoFijoAlerta>,
  fechaReferencia: Date | string
): ResultadoCalculoVencimiento;
```

---

### 7.3. Arquitectura de Notificaciones (Inversión de Dependencias y Desacoplamiento)

Siguiendo el principio de inversión de dependencias (DIP) y la arquitectura hexagonal:

```
┌─────────────────────────────────────────────────────────────┐
│                      CAPA DE DOMINIO                        │
│   - GastoFijoAlerta (Modelo)                                │
│   - calcularVencimientoGastoFijo() (Función Pura)          │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Consume contrato abstracto)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     PUERTO DE SALIDA                        │
│   - interface NotificationProvider                          │
│   - NotificationPayload / NotificationResult                │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────────┐         ┌───────────────────────────┐
│     ADAPTADOR WEB PUSH    │         │      ADAPTADOR FCM        │
│  - WebPushProvider        │         │  - FcmNotificationProvider│
│  - Service Worker Push    │         │  - /api/notify (Vercel)   │
└───────────────────────────┘         └───────────────────────────┘
```

#### Contrato Formal del Puerto (`NotificationProvider`):

```typescript
export interface NotificationPayload {
  readonly title: string;
  readonly body: string;
  readonly tag: string; // Para agrupar o reemplazar alertas del mismo gasto
  readonly data?: Readonly<Record<string, unknown>>;
  readonly priority?: 'high' | 'normal';
}

export interface NotificationResult {
  readonly success: boolean;
  readonly messageId?: string;
  readonly error?: string;
  readonly timestamp: string; // ISO 8601
}

/**
 * Puerto desacoplado para cualquier canal de notificaciones push.
 * Prohibido acoplar implementaciones o SDKs externos a este contrato.
 */
export interface NotificationProvider {
  readonly providerName: string;
  
  /**
   * Envía una notificación push al destinatario indicado.
   */
  sendNotification(
    recipientId: string,
    payload: NotificationPayload
  ): Promise<NotificationResult>;
  
  /**
   * Verifica la disponibilidad del canal en el entorno actual.
   */
  isSupported(): Promise<boolean> | boolean;
}
```

> [!WARNING]
> **Prohibición de Acoplamiento Directo:**
> - Queda **estrictamente prohibido** importar Firebase SDK (`firebase/messaging`), bibliotecas de Web Push o Capacitor Push dentro de la lógica de dominio o de cálculo de vencimientos.
> - La orquestación (lectura de datos $\to$ cálculo puro $\to$ despacho vía `NotificationProvider`) residirá en un servicio orquestador o worker/cron desacoplado.

---

### 7.4. Matriz de Cobertura y Casos de Borde (Testing Unitario)

Para preservar la regla de 0 regresiones del proyecto (283 tests pasando), el nuevo módulo debe acompañarse de suites en Vitest que cubran:
1. **Casos de Fin de Mes:** Días límite 29, 30 y 31 en febrero común (28 días) y bisiesto (29 días).
2. **Cambios de Año:** Gasto con vencimiento a inicios de enero evaluado desde finales de diciembre.
3. **Invariancia Horaria:** Evaluaciones a las 00:00:01, 12:00:00 y 23:59:59 deben arrojar idénticos días restantes.
4. **Mock Provider:** Pruebas del orquestador mediante un `MockNotificationProvider` en memoria, sin conexiones de red.

