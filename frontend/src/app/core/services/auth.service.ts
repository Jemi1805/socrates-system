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
  private loginAtKey = 'auth_login_at';
  private permissionCodes: string[] | null = null;
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.isLoggedIn());
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
            this.setLoginAt(Date.now());
            this.isAuthenticatedSubject.next(true);
          }
        })
      );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.loginAtKey);
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
    this.permissionCodes = this.extractPermissionCodes(user);
  }

  getUser(): any {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) return null;
    try {
      const user = JSON.parse(raw);
      // Actualizar cache de permisos si no está cargada
      if (this.permissionCodes === null) {
        this.permissionCodes = this.extractPermissionCodes(user);
      }
      return user;
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
    return this.hasToken() && !this.isTokenExpired();
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

  private setLoginAt(ts: number) {
    localStorage.setItem(this.loginAtKey, String(ts));
  }

  private getLoginAt(): number | null {
    const v = localStorage.getItem(this.loginAtKey);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  isTokenExpired(maxMinutes = 180): boolean {
    const ts = this.getLoginAt();
    if (!ts) return false;
    const elapsedMs = Date.now() - ts;
    return elapsedMs >= maxMinutes * 60 * 1000;
  }

  // Actualiza la marca de última actividad a "ahora" para implementar expiración por inactividad
  touchActivity(): void {
    this.setLoginAt(Date.now());
  }

  // --- Permisos en frontend ---
  private extractPermissionCodes(user: any): string[] {
    if (!user) return [];
    const perms = (user.permisos || user.permissions || []);
    if (!Array.isArray(perms)) return [];
    return perms
      .map((p: any) => (p && (p.codigo || p.code)) as string | undefined)
      .filter((c): c is string => !!c)
      .map((c) => c.trim().toLowerCase());
  }

  private getPermissionCodes(): string[] {
    if (this.permissionCodes !== null) {
      return this.permissionCodes;
    }
    const user = this.getUser();
    this.permissionCodes = this.extractPermissionCodes(user);
    return this.permissionCodes;
  }

  hasPermission(code: string): boolean {
    if (!code) return false;
    const target = code.trim().toLowerCase();
    return this.getPermissionCodes().includes(target);
  }

  hasAnyPermission(codes: string[]): boolean {
    if (!Array.isArray(codes) || codes.length === 0) return false;
    const targets = codes.map(c => c.trim().toLowerCase());
    const current = this.getPermissionCodes();
    return targets.some(t => current.includes(t));
  }
}