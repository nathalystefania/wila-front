import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/replacement/replacement').then(m => m.ReplacementComponent)
  },
];