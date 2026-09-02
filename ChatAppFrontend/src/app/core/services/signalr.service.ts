import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { Message, Attachment } from '../models/message.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private hubConnection: signalR.HubConnection | null = null;

  messages$ = new BehaviorSubject<Message[]>([]);
  typingUsers$ = new BehaviorSubject<string[]>([]);
  onlineUsers$ = new BehaviorSubject<string[]>([]);

  roomDeleted$ = new Subject<number>();
  memberRemoved$ = new Subject<{ roomId: number; userId: string }>();
  memberPromoted$ = new Subject<{ roomId: number; userId: string }>();
  memberLeft$ = new Subject<{ roomId: number; userId: string }>();
  groupKeyRotated$ = new Subject<{ roomId: number; version: number }>();
  incomingCall$ = new Subject<{ callerId: string; callerName: string; roomId: number; isVideo: boolean }>();
  callOfferReceived$ = new Subject<{ callerId: string; sdp: string; roomId: number; isVideo: boolean }>();
  callAnswerReceived$ = new Subject<{ callerId: string; sdp: string }>();
  iceCandidateReceived$ = new Subject<{ callerId: string; candidate: string }>();
  callRejected$ = new Subject<{ callerId: string }>();
  callEnded$ = new Subject<{ callerId: string }>();
  
  groupCallStarted$ = new Subject<{ roomId: number; callerId: string; callerName: string; isVideo: boolean }>();
  existingParticipants$ = new Subject<{ roomId: number; participants: { userId: string; userName: string }[] }>();
  participantJoined$ = new Subject<{ roomId: number; userId: string; userName: string }>();
  participantLeft$ = new Subject<{ roomId: number; userId: string }>();

  constructor(private authService: AuthService) {}

  async startConnection(): Promise<void> {
    const token = this.authService.getToken();
    console.log('SignalR token exists:', !!token);

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`http://localhost:5082/chathub?access_token=${token}`, {
        transport: signalR.HttpTransportType.WebSockets,
        skipNegotiation: true
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

  async sendMessage(roomId: number, content: string, replyToMessageId?: number,
  attachment?: { fileUrl: string; fileName: string; fileType: string;
    fileSizeBytes: number; messageType: string }): Promise<void> {
  console.log('SignalR sendMessage called - roomId:', roomId, 'content:', content);
  console.log('Hub connection state:', this.hubConnection?.state);
  if (this.hubConnection) {
    await this.hubConnection.invoke(
      'SendMessage', roomId, content, replyToMessageId ?? null, attachment ?? null
    );
  }
}

  async deleteMessage(messageId: number): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.invoke('DeleteMessage', messageId);
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

  async callUser(targetUserId: string, roomId: number, isVideo: boolean): Promise<void> {
  if (this.hubConnection) {
    await this.hubConnection.invoke('CallUser', targetUserId, roomId, isVideo);
  }
}

async sendCallOffer(targetUserId: string, sdp: string, roomId: number, isVideo: boolean): Promise<void> {
  if (this.hubConnection) {
    await this.hubConnection.invoke('SendCallOffer', targetUserId, sdp, roomId, isVideo);
  }
}

async sendCallAnswer(targetUserId: string, sdp: string): Promise<void> {
  if (this.hubConnection) {
    await this.hubConnection.invoke('SendCallAnswer', targetUserId, sdp);
  }
}

async sendIceCandidate(targetUserId: string, candidate: string): Promise<void> {
  if (this.hubConnection) {
    await this.hubConnection.invoke('SendIceCandidate', targetUserId, candidate);
  }
}

async rejectCall(targetUserId: string): Promise<void> {
  if (this.hubConnection) {
    await this.hubConnection.invoke('RejectCall', targetUserId);
  }
}

async endCall(targetUserId: string): Promise<void> {
  if (this.hubConnection) {
    await this.hubConnection.invoke('EndCall', targetUserId);
  }
}

async startGroupCall(roomId: number, isVideo: boolean): Promise<void> {
  if (this.hubConnection) await this.hubConnection.invoke('StartGroupCall', roomId, isVideo);
}

async joinGroupCall(roomId: number, isVideo: boolean): Promise<void> {
  if (this.hubConnection) await this.hubConnection.invoke('JoinGroupCall', roomId, isVideo);
}

async leaveGroupCall(roomId: number): Promise<void> {
  if (this.hubConnection) await this.hubConnection.invoke('LeaveGroupCall', roomId);
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

    this.hubConnection.on('MessageDeleted', (_roomId: number, messageId: number) => {
      const current = this.messages$.value;
      this.messages$.next(current.map(m =>
        m.id === messageId
          ? { ...m, isDeleted: true, content: 'This message was deleted' }
          : m
      ));
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

    this.hubConnection.on('RoomDeleted', (roomId: number) => {
      this.roomDeleted$.next(roomId);
    });

    this.hubConnection.on('MemberRemoved', (roomId: number, userId: string) => {
      this.memberRemoved$.next({ roomId, userId });
    });

    this.hubConnection.on('MemberPromoted', (roomId: number, userId: string) => {
      this.memberPromoted$.next({ roomId, userId });
    });

    this.hubConnection.on('MemberLeft', (roomId: number, userId: string) => {
      this.memberLeft$.next({ roomId, userId });
    });

    this.hubConnection.on('GroupKeyRotated', (roomId: number, version: number) => {
      this.groupKeyRotated$.next({ roomId, version });
    });

    this.hubConnection.on('IncomingCall', (callerId: string, callerName: string, roomId: number, isVideo: boolean) => {
      this.incomingCall$.next({ callerId, callerName, roomId, isVideo });
    });

    this.hubConnection.on('ReceiveCallOffer', (callerId: string, sdp: string, roomId: number, isVideo: boolean) => {
      this.callOfferReceived$.next({ callerId, sdp, roomId, isVideo });
    });

    this.hubConnection.on('ReceiveCallAnswer', (callerId: string, sdp: string) => {
      this.callAnswerReceived$.next({ callerId, sdp });
    });

    this.hubConnection.on('ReceiveIceCandidate', (callerId: string, candidate: string) => {
      this.iceCandidateReceived$.next({ callerId, candidate });
    });

    this.hubConnection.on('CallRejected', (callerId: string) => {
      this.callRejected$.next({ callerId });
    });

    this.hubConnection.on('CallEnded', (callerId: string) => {
      this.callEnded$.next({ callerId });
    });

    this.hubConnection.on('GroupCallStarted', (roomId: number, callerId: string, callerName: string, isVideo: boolean) => {
      this.groupCallStarted$.next({ roomId, callerId, callerName, isVideo });
    });

    this.hubConnection.on('ExistingParticipants', (roomId: number, participants: { userId: string; userName: string }[]) => {
      this.existingParticipants$.next({ roomId, participants });
    });

    this.hubConnection.on('ParticipantJoined', (roomId: number, userId: string, userName: string) => {
      this.participantJoined$.next({ roomId, userId, userName });
    });

    this.hubConnection.on('ParticipantLeft', (roomId: number, userId: string) => {
      this.participantLeft$.next({ roomId, userId });
    });
  }
}