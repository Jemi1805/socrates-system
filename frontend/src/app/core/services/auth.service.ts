import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface LoginCredentials {
  nombre_usuario: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    usuario?: any; // backend actual
    user?: any;    // compatibilidad
    token: string;
    token_type: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private tokenKey = 'auth_token';
  private userKey = 'auth_user';
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, credentials)
      .pipe(
        tap(response => {
          if (response.success && response.data?.token) {
            this.setToken(response.data.token);
            const user = (response.data as any).usuario ?? (response.data as any).user;
            if (user) {
              this.setUser(user);
            }
            this.isAuthenticatedSubject.next(true);
          }
        })
      );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.isAuthenticatedSubject.next(false);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  private setUser(user: any): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  getUser(): any {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn('auth_user inválido en localStorage, limpiando...', e);
      localStorage.removeItem(this.userKey);
      return null;
    }
  }

  private hasToken(): boolean {
    return !!this.getToken();
  }

  isLoggedIn(): boolean {
    return this.hasToken();
  }

  // Refresca el usuario desde el backend y lo guarda en localStorage
  me() {
    return this.http.get<any>(`${this.apiUrl}/auth/me`).pipe(
      tap((res) => {
        const u = (res?.data?.usuario ?? res?.data?.user ?? res?.usuario ?? res?.user);
        if (u) {
          this.setUser(u);
        }
      })
    );
  }
} 