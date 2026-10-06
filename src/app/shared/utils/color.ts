export function hexToRgba(hex: string, alpha: number): string {
  if (!hex || typeof hex !== 'string') {
    return `rgba(0, 0, 0, ${alpha ?? 1})`;
  }
  const cleanHex = hex.replace('#', '').trim().slice(0, 8);
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16) || 0;
    const g = parseInt(cleanHex[1] + cleanHex[1], 16) || 0;
    const b = parseInt(cleanHex[2] + cleanHex[2], 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const r = parseInt(cleanHex.slice(0, 2), 16) || 0;
  const g = parseInt(cleanHex.slice(2, 4), 16) || 0;
  const b = parseInt(cleanHex.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

