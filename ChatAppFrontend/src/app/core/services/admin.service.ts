import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminUser, AdminStats } from '../models/admin.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly API = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.API}/users`);
  }

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.API}/stats`);
  }

  toggleSiteAdmin(userId: string): Observable<{ isSiteAdmin: boolean }> {
  return this.http.post<{ isSiteAdmin: boolean }>(
    `${this.API}/users/${userId}/toggle-admin`, {}
  );
}


}