import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

/** Route guard factory: requires a logged-in user with the given role, else redirects sensibly. */
export const roleGuard = (role: Role): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.user();
  if (!user) return router.parseUrl('/login');
  return user.role === role ? true : router.parseUrl(auth.homeFor(user));
};
