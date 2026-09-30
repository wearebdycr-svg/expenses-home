/**
 * Utilidades de formateo para números, monedas y campos de entrada con separador de miles.
 */

/**
 * Formatea una cadena o número agregando separadores de miles con punto (.)
 * Ejemplo: 1000000 -> "1.000.000"
 */
export function formatThousands(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const digitsOnly = String(value).replace(/\D/g, '');
  if (!digitsOnly) return '';
  return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Convierte una cadena con separador de miles en un número entero limpio.
 * Ejemplo: "1.000.000" -> 1000000
 */
export function parseThousands(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const digitsOnly = String(value).replace(/\D/g, '');
  return digitsOnly ? Number(digitsOnly) : 0;
}
