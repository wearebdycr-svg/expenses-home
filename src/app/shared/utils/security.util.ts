/**
 * Utilidades de ciberseguridad y sanitización para Expenses Home
 */

/**
 * Sanitiza texto inseguro reemplazando caracteres especiales por entidades HTML.
 * Previene vulnerabilidades de Cross-Site Scripting (XSS) al insertar texto en el DOM
 * (por ejemplo, en tooltips personalizados de Chart.js o manipulaciones directas).
 */
export function escapeHtml(unsafe: unknown): string {
  if (unsafe === null || unsafe === undefined) {
    return '';
  }

  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
