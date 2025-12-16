import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { catchError, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();

  // Solo añadir el header para llamadas a la API de nuestro backend
  const isApiCall = req.url.startsWith(environment.apiUrl) || req.url.includes('/api/');
  const isAuthLoginCall = isApiCall && req.url.includes('/auth/login');

  // Si el token está expirado por inactividad, forzar logout para llamadas normales,
  // pero permitir que la llamada de login pase para poder reautenticar.
  if (token && isApiCall && !isAuthLoginCall && auth.isTokenExpired()) {
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
    // Cualquier respuesta exitosa a la API renueva la marca de última actividad
    tap({
      next: () => {
        if (isApiCall && !isAuthLoginCall) {
          auth.touchActivity();
        }
      },
    }),
    catchError((error) => {
      if (error?.status === 401 && !isAuthLoginCall) {
        auth.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
