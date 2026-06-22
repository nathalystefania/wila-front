import { Routes } from '@angular/router';
import { CompanySelector } from '@features/company-selector/company-selector';
import { MainLayoutComponent } from './layouts/main-layout/main-layout';
// import { DashboardComponent } from '@features/dashboard/dashboard.component';
// import { MotorsComponent } from '@features/motors/motors.component';
// import { SensorsComponent } from '@features/sensors/sensors.component';
// import { UsersComponent } from '@features/users/users.component';
import { CompanyGuard } from '@core/guards/company-guard/company.guard';

export const routes: Routes = [
  {
    path: 'select-company',
    component: CompanySelector,
  },

  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [CompanyGuard],
    // children: [
    //   {
    //     path: 'dashboard',
    //     component: DashboardComponent,
    //   },
    //   {
    //     path: 'motors',
    //     component: MotorsComponent,
    //   },
    //   {
    //     path: 'sensors',
    //     component: SensorsComponent,
    //   },
    //   {
    //     path: 'users',
    //     component: UsersComponent,
    //   },
    // ],
  },

  {
    path: '**',
    redirectTo: 'select-company',
  },
];
