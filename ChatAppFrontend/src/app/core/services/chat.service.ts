import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChatRoom } from '../models/chat-room.model';
import { Message } from '../models/message.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly API = 'http://localhost:5082/api';

  constructor(private http: HttpClient) {}

  getMyRooms(): Observable<ChatRoom[]> {
    return this.http.get<ChatRoom[]>(`${this.API}/chatrooms`);
  }

  getRoom(id: number): Observable<ChatRoom> {
    return this.http.get<ChatRoom>(`${this.API}/chatrooms/${id}`);
  }

  createRoom(name: string, isGroup: boolean,
    memberIds: string[]): Observable<ChatRoom> {
    return this.http.post<ChatRoom>(`${this.API}/chatrooms`, {
      name, isGroup, memberIds
    });
  }

  getMessages(roomId: number,
    cursor?: number): Observable<Message[]> {
    const params = cursor ? `?cursor=${cursor}&limit=50` : '?limit=50';
    return this.http.get<Message[]>(
      `${this.API}/chatrooms/${roomId}/messages${params}`
    );
  }
}