import { Routes } from '@angular/router';
import { Layout } from './layout/layout';

export const routes: Routes = [
  {
    path: 'onboarding',
    loadChildren: () =>
      import('./features/onboarding/onboarding.routes')
        .then(m => m.ONBOARDING_ROUTES)
  },
  {
    path: '',
    component: Layout,
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        data: {
          breadcrumb: 'Inicio',
        },
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes')
            .then(m => m.DASHBOARD_ROUTES)
      },
      // {
      //   path: 'settings',
      //   data: {
      //     breadcrumb: 'Configuración',
      //   },
      //   loadChildren: () =>
      //     import('./features/settings/settings.routes')
      //       .then(m => m.SETTINGS_ROUTES)
      // },
      {
        path: 'alarmas',
        data: {
          breadcrumb: 'Alarmas',
        },
        loadComponent: () =>
          import(
            './features/dashboard/pages/alarmas/alarmas'
          ).then(
            m => m.Alarmas
          ),
      },
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];