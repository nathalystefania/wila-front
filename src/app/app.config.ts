import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { provideAppIcons } from './core/icons/icons.provider';
import { POLLING_CONFIG, DEFAULT_POLLING_CONFIG } from '@core/config/polling.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppIcons(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    { provide: POLLING_CONFIG, useValue: DEFAULT_POLLING_CONFIG },
  ],
};
