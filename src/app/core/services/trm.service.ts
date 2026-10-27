import { Injectable, signal } from '@angular/core';

const STORAGE_TRM_KEY = 'expenses_home_trm_v2';
const DEFAULT_TRM = 3155;

export interface CachedTrmData {
  rate: number;
  date: string; // YYYY-MM-DD
  source: string;
}

@Injectable({ providedIn: 'root' })
export class TrmService {
  private readonly trmSignal = signal<number>(this.loadCachedTrm());
  readonly trm = this.trmSignal.asReadonly();

  readonly loading = signal<boolean>(false);
  readonly lastUpdated = signal<string | null>(null);

  constructor() {
    this.refreshTrm();
  }

  private getTodayIso(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  private loadCachedTrm(): number {
    try {
      const stored = localStorage.getItem(STORAGE_TRM_KEY);
      if (stored) {
        const parsed: CachedTrmData = JSON.parse(stored);
        if (parsed.rate > 0) {
          return parsed.rate;
        }
      }
    } catch {
      // Fallback a defecto
    }
    return DEFAULT_TRM;
  }

  /**
   * Consulta la TRM oficial del día.
   * Prioriza la API oficial de la Superintendencia Financiera (datos.gov.co).
   * Usa como respaldo secundario open.er-api.com.
   * Si no hay conexión o falla, utiliza la última tasa en caché.
   */
  async refreshTrm(force = false): Promise<number> {
    const today = this.getTodayIso();

    // Si ya consultamos hoy y no es forzado, usar el valor en memoria / caché
    if (!force) {
      try {
        const stored = localStorage.getItem(STORAGE_TRM_KEY);
        if (stored) {
          const parsed: CachedTrmData = JSON.parse(stored);
          if (parsed.date === today && parsed.rate > 0) {
            this.trmSignal.set(parsed.rate);
            this.lastUpdated.set(parsed.date);
            return parsed.rate;
          }
        }
      } catch {
        // Continuar a la consulta
      }
    }

    this.loading.set(true);

    try {
      // 1. Intentar API oficial de Superfinanciera Colombia (Datos Abiertos)
      const officialUrl = 'https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciahasta%20DESC';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const resp = await fetch(officialUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0 && data[0].valor) {
          const rate = Math.round(parseFloat(data[0].valor) * 100) / 100;
          if (rate > 1000) {
            this.saveTrmToCache(rate, today, 'Superfinanciera Oficial');
            return rate;
          }
        }
      }
    } catch {
      // Intentar respaldo
    }

    try {
      // 2. Respaldo secundario: open.er-api.com
      const backupUrl = 'https://open.er-api.com/v6/latest/USD';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const resp = await fetch(backupUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        const copRate = data?.rates?.COP;
        if (copRate && typeof copRate === 'number' && copRate > 1000) {
          const rate = Math.round(copRate * 100) / 100;
          this.saveTrmToCache(rate, today, 'ExchangeRate API');
          return rate;
        }
      }
    } catch {
      // Continuar a valor en caché
    } finally {
      this.loading.set(false);
    }

    // 3. Fallback a caché existente o constante por defecto
    const cached = this.loadCachedTrm();
    this.trmSignal.set(cached);
    return cached;
  }

  private saveTrmToCache(rate: number, date: string, source: string): void {
    const payload: CachedTrmData = { rate, date, source };
    try {
      localStorage.setItem(STORAGE_TRM_KEY, JSON.stringify(payload));
    } catch {
      // localStorage no disponible
    }
    this.trmSignal.set(rate);
    this.lastUpdated.set(date);
    this.loading.set(false);
  }

  /**
   * Convierte un monto en dólares (USD) a pesos colombianos (COP) redondeado.
   */
  convertUsdToCop(amountUsd: number, trm?: number): number {
    const rate = trm && trm > 0 ? trm : this.trmSignal();
    return Math.round(amountUsd * rate);
  }

  /**
   * Formatea un valor en dólares con formato estadounidense US$ 1,234.56
   */
  formatUSD(amount: number | null | undefined): string {
    if (amount === null || amount === undefined || isNaN(amount)) return '—';
    return `US$ ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}
