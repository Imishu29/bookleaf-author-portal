import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** Adds the bearer token; an expired/invalid session (401 on a non-login call) logs the user out. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !req.url.endsWith('/auth/login')) auth.logout();
      return throwError(() => err);
    })
  );
};

/** Pulls the API's `{ error: { message } }` envelope into a displayable string. */
export function errorMessage(err: unknown): string {
  const e = err as HttpErrorResponse;
  if (e?.status === 0) return 'Cannot reach the server. Please check your connection.';
  const api = e?.error?.error;
  if (api?.details?.length) return api.details.map((d: { message: string }) => d.message).join(' · ');
  return api?.message || 'Something went wrong. Please try again.';
}
