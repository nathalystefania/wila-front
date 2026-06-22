import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { provideAppIcons } from './core/icons/icons.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppIcons(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
  ]
};