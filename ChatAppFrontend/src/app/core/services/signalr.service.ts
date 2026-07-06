import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { Message } from '../models/message.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private hubConnection: signalR.HubConnection | null = null;

  messages$ = new BehaviorSubject<Message[]>([]);
  typingUsers$ = new BehaviorSubject<string[]>([]);
  onlineUsers$ = new BehaviorSubject<string[]>([]);

  constructor(private authService: AuthService) {}

  async startConnection(): Promise<void> {
    const token = this.authService.getToken();

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5082/chathub', {
        accessTokenFactory: () => token || ''
      })
      .withAutomaticReconnect()
      .build();

    this.registerHandlers();

    try {
      await this.hubConnection.start();
      console.log('SignalR connected');
    } catch (err) {
      console.error('SignalR connection error:', err);
    }
  }

  async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = null;
    }
  }

  async joinRoom(roomId: number): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.invoke('JoinRoom', roomId);
    }
  }

  async leaveRoom(roomId: number): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.invoke('LeaveRoom', roomId);
    }
  }

  async sendMessage(roomId: number, content: string): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.invoke('SendMessage', roomId, content);
    }
  }

  async startTyping(roomId: number): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.invoke('StartTyping', roomId);
    }
  }

  async stopTyping(roomId: number): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.invoke('StopTyping', roomId);
    }
  }

  async markAsRead(roomId: number, messageId: number): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.invoke('MarkAsRead', roomId, messageId);
    }
  }

  clearMessages(): void {
    this.messages$.next([]);
  }

  private registerHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.on('ReceiveMessage', (message: Message) => {
      const current = this.messages$.value;
      this.messages$.next([...current, message]);
    });

    this.hubConnection.on('UserTyping', (_roomId: number, userName: string) => {
      const current = this.typingUsers$.value;
      if (!current.includes(userName)) {
        this.typingUsers$.next([...current, userName]);
      }
    });

    this.hubConnection.on('UserStoppedTyping', (_roomId: number, userName: string) => {
      this.typingUsers$.next(
        this.typingUsers$.value.filter(u => u !== userName)
      );
    });

    this.hubConnection.on('UserOnline', (userId: string) => {
      const current = this.onlineUsers$.value;
      if (!current.includes(userId)) {
        this.onlineUsers$.next([...current, userId]);
      }
    });

    this.hubConnection.on('UserOffline', (userId: string) => {
      this.onlineUsers$.next(
        this.onlineUsers$.value.filter(id => id !== userId)
      );
    });
  }
}