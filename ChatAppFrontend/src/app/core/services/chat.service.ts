import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChatRoom } from '../models/chat-room.model';
import { Message } from '../models/message.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly API = `${environment.apiUrl}/chatrooms`;

  constructor(private http: HttpClient) {}

  getMyRooms(): Observable<ChatRoom[]> {
    return this.http.get<ChatRoom[]>(this.API);
  }

  getRoom(id: number): Observable<ChatRoom> {
    return this.http.get<ChatRoom>(`${this.API}/${id}`);
  }

  createRoom(name: string, isGroup: boolean,
    memberIds: string[]): Observable<ChatRoom> {
    return this.http.post<ChatRoom>(this.API, {
      name, isGroup, memberIds
    });
  }

  startDirectMessage(userId: string): Observable<ChatRoom> {
    return this.http.post<ChatRoom>(`${this.API}/direct`, { userId });
  }

  removeMember(roomId: number, userId: string): Observable<any> {
    return this.http.delete(`${this.API}/${roomId}/members/${userId}`);
  }

  promoteToAdmin(roomId: number, userId: string): Observable<any> {
    return this.http.post(`${this.API}/${roomId}/members/${userId}/promote`, {});
  }

  leaveRoom(roomId: number): Observable<any> {
    return this.http.post(`${this.API}/${roomId}/leave`, {});
  }

  deleteRoom(roomId: number): Observable<any> {
    return this.http.delete(`${this.API}/${roomId}`);
  }

  getMessages(roomId: number,
    cursor?: number): Observable<Message[]> {
    const params = cursor ? `?cursor=${cursor}&limit=50` : '?limit=50';
    return this.http.get<Message[]>(
      `${this.API}/${roomId}/messages${params}`
    );
  }
}