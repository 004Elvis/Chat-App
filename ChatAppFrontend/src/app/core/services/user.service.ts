import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly API = environment.apiUrl;

  constructor(private http: HttpClient) {}

  searchUsers(query: string): Observable<User[]> {
    return this.http.get<User[]>(
      `${this.API}/users/search?query=${query}`
    );
  }

  getMe(): Observable<User> {
    return this.http.get<User>(`${this.API}/users/me`);
  }

  addMember(roomId: number, userId: string): Observable<any> {
    return this.http.post(
      `${this.API}/chatrooms/${roomId}/members`,
      JSON.stringify(userId),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  uploadAvatar(file: File): Observable<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ avatarUrl: string }>(
      `${this.API}/users/me/avatar`, formData
    );
  }

  updateUsername(userName: string): Observable<{ userName: string }> {
    return this.http.put<{ userName: string }>(
      `${this.API}/users/me/username`, { userName }
    );
  }
}