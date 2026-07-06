import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly API = 'http://localhost:5082/api';

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
}