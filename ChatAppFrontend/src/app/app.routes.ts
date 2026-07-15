import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'chat',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component')
        .then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component')
        .then(m => m.RegisterComponent)
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('./features/chat/chat.component')
        .then(m => m.ChatComponent),
    canActivate: [authGuard]
  },
  {
  path: 'forgot-password',
  loadComponent: () =>
    import('./features/auth/forgot-password/forgot-password.component')
      .then(m => m.ForgotPasswordComponent)
},
{
  path: 'reset-password',
  loadComponent: () =>
    import('./features/auth/reset-password/reset-password.component')
      .then(m => m.ResetPasswordComponent)
},
{
  path: 'verify-email',
  loadComponent: () =>
    import('./features/auth/verify-email/verify-email.component')
      .then(m => m.VerifyEmailComponent)
},
  {
    path: '**',
    redirectTo: 'chat'
  }
];