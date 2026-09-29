# Finanzas Hogar · Control Familiar

Aplicación web moderna y colaborativa para la gestión de finanzas compartidas y personales del hogar, construida con **Angular 22**, **Chart.js** y **Supabase (PostgreSQL)**.

---

## 🚀 Características

- **Gestión de Ingresos (HU02)**: Registro y seguimiento de ingresos individuales para Benny y Charlie con cálculo de aportes proporcionales y fijos.
- **Control de Gastos Diarios (HU03)**:
  - Registro de gastos por fecha, categoría y pagador (Benny, Charlie, Compartido).
  - Filtros dinámicos por año, mes, día y persona.
  - Indicadores clave (KPIs): Total del período seleccionado y conteo de transacciones.
  - Gráfico de barras apiladas día a día con tooltip interactivo.
  - Gráfico de dona de distribución por categoría con porcentajes y montos.
  - Tabla de transacciones con opciones de edición y eliminación.
- **Base de Datos en Tiempo Real**: Sincronización instantánea con Supabase.
- **Seguridad**: Content Security Policy (CSP), headers de seguridad HTTP y protección de credenciales mediante variables de entorno.

---

## 🛠️ Stack Tecnológico

- **Frontend**: Angular 22 (Standalone Components, Signals)
- **Visualización**: Chart.js / ng2-charts
- **Backend / Database**: Supabase (PostgreSQL con RLS & Realtime)
- **Despliegue**: Vercel

---

## 💻 Desarrollo Local

1. **Clonar repositorio e instalar dependencias:**
   ```bash
   git clone https://github.com/wearebdycr-svg/expenses-home.git
   cd expenses-home
   npm install
   ```

2. **Configurar variables de entorno:**
   Copia el archivo de ejemplo y agrega tus credenciales de Supabase:
   ```bash
   cp .env.example .env
   ```

3. **Iniciar el servidor de desarrollo:**
   ```bash
   npm start
   ```
   La aplicación estará disponible en `http://localhost:4200/`.

---

## 📦 Compilación y Despliegue

Para compilar la aplicación para producción:
```bash
npm run build
```
Los artefactos se generarán en la carpeta `dist/expenses-home/browser`.
