import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { routes } from './app.routes';
import { NOTIFICATION_PROVIDER } from './core/notifications/notification-provider.interface';
import { FcmNotificationAdapter } from './core/notifications/adapters/fcm-notification.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    provideCharts(withDefaultRegisterables()),
    { provide: NOTIFICATION_PROVIDER, useExisting: FcmNotificationAdapter }
  ]
};
