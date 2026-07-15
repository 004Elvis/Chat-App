import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse, LoginDto, RegisterDto } from '../models/auth.model';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'chat_token';
  private readonly USER_KEY = 'chat_user';

  currentUser = signal<User | null>(this.getStoredUser());

  constructor(private http: HttpClient, private router: Router) {}

  register(dto: RegisterDto): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/register`, dto).pipe(
      tap(response => this.handleAuthResponse(response))
    );
  }

  login(dto: LoginDto): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/login`, dto).pipe(
      tap(response => this.handleAuthResponse(response))
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private handleAuthResponse(response: AuthResponse): void {
  localStorage.setItem(this.TOKEN_KEY, response.token);
  const user: User = {
    id: response.userId,
    userName: response.userName,
    email: '',
    avatarUrl: response.avatarUrl,
    isEmailVerified: response.isEmailVerified
  };
  localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  this.currentUser.set(user);
}

  private getStoredUser(): User | null {
    const stored = localStorage.getItem(this.USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }
  googleLogin(idToken: string) {
  return this.http.post<any>(`${environment.apiUrl}/auth/google`, { idToken });
}

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.get<{ message: string }>(`${this.API}/verify-email`, {
      params: { token }
    });
  }

  resendVerification(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API}/resend-verification`, {});
  }

  markEmailVerified(): void {
    const user = this.currentUser();
    if (!user) return;
    const updated: User = { ...user, isEmailVerified: true };
    localStorage.setItem(this.USER_KEY, JSON.stringify(updated));
    this.currentUser.set(updated);
  }
}