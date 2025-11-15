import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();

  // Solo añadir el header para llamadas a la API de nuestro backend
  const isApiCall = req.url.startsWith(environment.apiUrl) || req.url.includes('/api/');
  const isAuthLoginCall = isApiCall && req.url.includes('/auth/login');

  if (token && isApiCall && auth.isTokenExpired()) {
    auth.logout();
    router.navigate(['/login']);
    return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Token expired' }));
  }

  const authReq = token && isApiCall
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

  return next(authReq).pipe(
    catchError((error) => {
      if (error?.status === 401 && !isAuthLoginCall) {
        auth.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
