import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Public
  { path: 'login',    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/register/register').then(m => m.RegisterComponent) },

  // Protected (inside layout shell)
  {
    path: '',
    loadComponent: () => import('./layout/layout').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'contributions',
        loadComponent: () => import('./features/contributions/contributions').then(m => m.ContributionsComponent)
      },
      {
        path: 'pending',
        loadComponent: () => import('./features/pending/pending').then(m => m.PendingComponent)
      },
      {
        path: 'notifications',
        loadComponent: () => import('./features/notifications/notifications').then(m => m.NotificationsComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile').then(m => m.ProfileComponent)
      },
      {
        path: 'admin/users',
        loadComponent: () => import('./features/admin/users/admin-users').then(m => m.AdminUsersComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'admin/reports',
        loadComponent: () => import('./features/admin/reports/admin-reports').then(m => m.AdminReportsComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'admin/contribution-types',
        loadComponent: () => import('./features/admin/contribution-types/admin-contribution-types').then(m => m.AdminContributionTypesComponent),
        canActivate: [adminGuard]
      }
    ]
  },

  { path: '**', redirectTo: 'dashboard' }
];
