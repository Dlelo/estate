import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LoginRequest, RegisterRequest, AuthResponse, JwtPayload, User } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'em_token';
  private readonly base = `${environment.apiUrl}/api/auth`;

  private _token = signal<string | null>(localStorage.getItem(this.TOKEN_KEY));

  readonly isLoggedIn = computed(() => !!this._token());
  readonly token = computed(() => this._token());

  readonly currentUser = computed<Partial<User> | null>(() => {
    const t = this._token();
    if (!t) return null;
    try {
      const payload: any = JSON.parse(atob(t.split('.')[1]));
      // JWT uses 'role' claim (comma-separated)
      const roleStr: string = payload.role ?? payload.roles ?? '';
      const roles = roleStr
        ? roleStr.split(',').map((r: string) => ({ id: 0, name: r.trim() }))
        : [];
      return { phoneNumber: payload.sub, roles };
    } catch { return null; }
  });

  readonly isAdmin = computed(() => {
    const u = this.currentUser();
    return u?.roles?.some(r => {
      const name = typeof r === 'string' ? r : (r as any).name;
      return name === 'ADMIN' || name === 'ROLE_ADMIN';
    }) ?? false;
  });

  constructor(private http: HttpClient, private router: Router) {}

  login(req: LoginRequest) {
    return this.http.post<AuthResponse>(`${this.base}/login`, req).pipe(
      tap(res => this.setToken(res.token))
    );
  }

  register(req: RegisterRequest) {
    return this.http.post<void>(`${this.base}/register`, req);
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    this._token.set(null);
    this.router.navigate(['/login']);
  }

  private setToken(token: string) {
    localStorage.setItem(this.TOKEN_KEY, token);
    this._token.set(token);
  }

  getUserIdFromToken(): number | null {
    const t = this._token();
    if (!t) return null;
    try {
      const payload: any = JSON.parse(atob(t.split('.')[1]));
      // userId is added to JWT by backend; cast to number if present
      const id = payload.userId;
      return id != null ? Number(id) : null;
    } catch { return null; }
  }
}
