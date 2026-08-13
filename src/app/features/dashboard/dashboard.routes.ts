import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    data: {
      breadcrumb: 'Dashboard',
    },
    loadComponent: () =>
      import('./pages/dashboard-home/dashboard-home')
        .then(m => m.DashboardHome)
  },
  {
    path: 'motor/:id',
    data: {
      breadcrumb: 'Detalle de motor',
    },
    loadComponent: () =>
      import('./pages/motor-detail/motor-detail')
        .then(m => m.MotorDetail)
  },
  {
    path: 'alarmas',
    data: {
      breadcrumb: 'Alarmas',
    },
    loadComponent: () =>
      import(
        './pages/alarmas/alarmas'
      ).then(
        m => m.Alarmas
      ),
  },
];