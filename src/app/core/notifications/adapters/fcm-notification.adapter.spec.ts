import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Capacitor } from '@capacitor/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FcmNotificationAdapter } from './fcm-notification.adapter';
import { NotificationPayload } from '../notification-provider.interface';
import { environment } from '../../../../environments/environment';
import { SupabaseService } from '../../services/supabase.service';

describe('FcmNotificationAdapter', () => {
  let adapter: FcmNotificationAdapter;
  let httpTesting: HttpTestingController;
  let getSessionMock: ReturnType<typeof vi.fn>;

  const mockPayload: NotificationPayload = {
    title: 'Alerta de Vencimiento',
    body: 'El arriendo vence hoy',
    tag: 'fixed-expense-1',
    data: { id: 1, amount: 1500000 },
    priority: 'high',
  };

  beforeEach(() => {
    getSessionMock = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'mock-supabase-jwt' } },
    });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        FcmNotificationAdapter,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              auth: {
                getSession: getSessionMock,
              },
            },
          },
        },
      ],
    });

    adapter = TestBed.inject(FcmNotificationAdapter);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    vi.restoreAllMocks();
  });

  it('debe crearse correctamente e identificar el proveedor como "fcm"', () => {
    expect(adapter).toBeTruthy();
    expect(adapter.providerName).toBe('fcm');
  });

  describe('isSupported', () => {
    it('debe retornar true si corre sobre plataforma nativa Capacitor', () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

      const supported = adapter.isSupported();

      expect(supported).toBe(true);
    });

    it('debe validar soporte web si no es plataforma nativa', () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

      const hasNotification = 'Notification' in window;
      const hasSW = 'serviceWorker' in navigator;
      const expected = hasNotification && hasSW;

      expect(adapter.isSupported()).toBe(expected);
    });
  });

  describe('getEndpointUrl', () => {
    it('debe devolver endpoint relativo /api/notify en navegador web', () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

      expect(adapter.getEndpointUrl()).toBe('/api/notify');
    });

    it('debe devolver endpoint absoluto con apiUrl en plataforma nativa', () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

      const url = adapter.getEndpointUrl();
      if (environment.apiUrl) {
        expect(url).toBe(`${environment.apiUrl.replace(/\/$/, '')}/api/notify`);
      } else {
        expect(url).toBe('/api/notify');
      }
    });
  });

  describe('sendNotification', () => {
    it('debe enviar la petición HTTP POST con el token JWT de sesión y retornar success true', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

      const sendPromise = adapter.sendNotification('fcm-token-123', mockPayload);
      await Promise.resolve();

      const req = httpTesting.expectOne('/api/notify');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        recipientId: 'fcm-token-123',
        title: mockPayload.title,
        body: mockPayload.body,
        tag: mockPayload.tag,
        data: {
          id: 1,
          amount: 1500000,
          tag: 'fixed-expense-1',
          priority: 'high',
        },
      });

      expect(req.request.headers.get('Authorization')).toBe('Bearer mock-supabase-jwt');

      req.flush({ success: true, messageId: 'msg-abc-987' });

      const result = await sendPromise;

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-abc-987');
      expect(result.error).toBeUndefined();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('debe rechazar el envío sin llamar HTTP cuando no existe sesión autenticada en Supabase', async () => {
      getSessionMock.mockResolvedValueOnce({ data: { session: null } });

      const result = await adapter.sendNotification('fcm-token-123', mockPayload);

      httpTesting.expectNone('/api/notify');
      expect(result.success).toBe(false);
      expect(result.error).toContain('no autenticada');
    });

    it('debe capturar fallo lógico de respuesta (success: false) sin lanzar excepción', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

      const sendPromise = adapter.sendNotification('fcm-token-123', mockPayload);
      await Promise.resolve();

      const req = httpTesting.expectOne('/api/notify');
      req.flush({ success: false, error: 'Token FCM inválido o revocado' });

      const result = await sendPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token FCM inválido o revocado');
      expect(result.timestamp).toBeDefined();
    });

    it('debe capturar errores HTTP 400/500 de forma segura sin romper la promesa', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

      const sendPromise = adapter.sendNotification('fcm-token-123', mockPayload);
      await Promise.resolve();

      const req = httpTesting.expectOne('/api/notify');
      req.flush(
        { error: 'Unauthorized: Se requiere token de autorización válido' },
        { status: 401, statusText: 'Unauthorized' }
      );

      const result = await sendPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
      expect(result.timestamp).toBeDefined();
    });

    it('debe capturar fallos de red (ErrorEvent) devolviendo success false', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

      const sendPromise = adapter.sendNotification('fcm-token-123', mockPayload);
      await Promise.resolve();

      const req = httpTesting.expectOne('/api/notify');
      req.error(new ProgressEvent('error'), { status: 0, statusText: 'Network Error' });

      const result = await sendPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });
});
