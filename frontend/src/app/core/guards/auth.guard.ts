import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);

  // Token present but expired → force logout before proceeding
  if (auth.isTokenExpired()) {
    auth.logout(true);
    return false;
  }

  if (auth.isLoggedIn()) return true;

  inject(Router).navigate(['/login']);
  return false;
};
