import { Routes } from '@angular/router';
import { Layout } from './layout/layout';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./features/onboarding/onboarding.routes')
        .then(m => m.ONBOARDING_ROUTES)
  },
  {
    path: '',
    component: Layout,
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes')
            .then(m => m.DASHBOARD_ROUTES)
      }
    ]
  },
  {
    path: 'settings',
    component: Layout,
    loadChildren: () =>
      import('./features/settings/settings.routes')
        .then(m => m.SETTINGS_ROUTES)
  },
  {
    path: '**',
    redirectTo: ''
  }
];