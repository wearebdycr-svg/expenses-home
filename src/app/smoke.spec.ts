import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from './app';
import { AuthPinService } from './core/services/auth-pin.service';
import { ExpensesService } from './features/gastos/data/expenses.service';
import type { ExpenseDraft } from './features/gastos/data/expense.model';

describe('Critical Smoke Tests (Wave 0.2)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Smoke Test 1: Application Entry Point & Shell Bootstrap', () => {
    it('debe inicializar la aplicación, autenticar en estado desbloqueado y renderizar el shell principal sin fallos', async () => {
      await TestBed.configureTestingModule({
        imports: [App],
      }).compileComponents();

      const authPinService = TestBed.inject(AuthPinService);
      authPinService.isUnlocked.set(true);

      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();

      // 1. Verificación de instancia del punto de entrada
      const appInstance = fixture.componentInstance;
      expect(appInstance).toBeTruthy();

      // 2. Verificación de página y estado de navegación por defecto
      expect(appInstance['currentPage']()).toBe('gastos');

      // 3. Verificación de integridad del DOM del Shell principal
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.app-shell')).toBeTruthy();
      expect(compiled.querySelector('app-sidebar')).toBeTruthy();
      expect(compiled.querySelector('main.app-content')).toBeTruthy();
      expect(compiled.querySelector('app-gastos-page')).toBeTruthy();
      expect(compiled.querySelector('app-toast-container')).toBeTruthy();
    });
  });

  describe('Smoke Test 2: Core Business Pipeline (Expenses Ingestion & Aggregation)', () => {
    it('debe ingerir un gasto mediante addExpense y reflejar la entrada y salida reactiva sin romper el estado', () => {
      TestBed.configureTestingModule({});
      const expensesService = TestBed.inject(ExpensesService);

      // Fijar período controlado para aislar el cálculo
      expensesService.setYear(2026);
      expensesService.setMonth(11);

      const baselineCount = expensesService.transactionCount();
      const baselineTotal = expensesService.totalPeriod();

      // Entrada principal: borrador de gasto
      const mockDraft: ExpenseDraft = {
        date: '2026-11-03',
        person: 'Compartido',
        category: 'Mercado',
        description: 'Compra de prueba de humo',
        amount: 150_000,
      };

      // Ingesta de datos
      expensesService.addExpense(mockDraft);

      // Verificación de salida: Señales reactivas actualizadas
      const currentExpenses = expensesService.allExpenses();
      expect(currentExpenses.length).toBeGreaterThan(0);

      const registered = currentExpenses.find(
        (e) => e.description === 'Compra de prueba de humo'
      );
      expect(registered).toBeDefined();
      expect(registered?.amount).toBe(150_000);
      expect(registered?.category).toBe('Mercado');
      expect(registered?.id).toBeTruthy();

      // Verificación de recálculo en tiempo real
      expect(expensesService.transactionCount()).toBe(baselineCount + 1);
      expect(expensesService.totalPeriod()).toBe(baselineTotal + 150_000);
    });
  });
});
