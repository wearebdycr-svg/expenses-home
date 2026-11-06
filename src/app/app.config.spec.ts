import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { appConfig } from './app.config';
import { NOTIFICATION_PROVIDER } from './core/notifications/notification-provider.interface';
import { FcmNotificationAdapter } from './core/notifications/adapters/fcm-notification.adapter';

describe('appConfig', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: appConfig.providers,
    });
  });

  it('should provide HttpClient', () => {
    const http = TestBed.inject(HttpClient);
    expect(http).toBeTruthy();
  });

  it('should bind NOTIFICATION_PROVIDER to FcmNotificationAdapter singleton', () => {
    const notificationProvider = TestBed.inject(NOTIFICATION_PROVIDER);
    const fcmAdapter = TestBed.inject(FcmNotificationAdapter);

    expect(notificationProvider).toBeTruthy();
    expect(notificationProvider).toBe(fcmAdapter);
    expect(notificationProvider.providerName).toBe('fcm');
  });
});
