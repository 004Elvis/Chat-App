import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { SignalRService } from '../../core/services/signalr.service';
import { ChatService } from '../../core/services/chat.service';
import { UserService } from '../../core/services/user.service';
import { CryptoService } from '../../core/services/crypto.service';
import { ChatRoom } from '../../core/models/chat-room.model';
import { Message } from '../../core/models/message.model';
import { ChatRoomListComponent } from './chat-room-list/chat-room-list.component';
import { ChatWindowComponent } from './chat-window/chat-window.component';
import { IconComponent } from '../../core/components/icon/icon.component';
import { CallOverlayComponent } from './call-overlay/call-overlay.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, AsyncPipe, ChatRoomListComponent, ChatWindowComponent, IconComponent, CallOverlayComponent],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css'
})
export class ChatComponent implements OnInit, OnDestroy {
  rooms = signal<ChatRoom[]>([]);
  selectedRoom = signal<ChatRoom | null>(null);
  messages = signal<Message[]>([]);
  loading = signal(true);
  showSidebar = signal(true);

  constructor(
    public authService: AuthService,
    public signalRService: SignalRService,
    private chatService: ChatService,
    private userService: UserService,
    private cryptoService: CryptoService
  ) {}

  async ngOnInit(): Promise<void> {
    this.setupEncryption();

    await this.signalRService.startConnection();
    this.loadRooms();

    this.signalRService.messages$.subscribe(async messages => {
      const currentRoom = this.selectedRoom();
      if (currentRoom && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.chatRoomId === currentRoom.id) {
          const roomMessages = messages.filter(
            m => m.chatRoomId === currentRoom.id
          );
          const decrypted = await this.decryptMessages(roomMessages, currentRoom);
          this.messages.set(decrypted);
        }
      }
    });

    this.signalRService.roomDeleted$.subscribe(roomId => {
      this.dropRoom(roomId);
    });

    this.signalRService.memberRemoved$.subscribe(({ roomId, userId }) => {
      if (userId === this.authService.currentUser()?.id) {
        this.dropRoom(roomId);
      } else {
        this.refreshRoom(roomId);
      }
    });

    this.signalRService.memberLeft$.subscribe(({ roomId, userId }) => {
      if (userId === this.authService.currentUser()?.id) {
        this.dropRoom(roomId);
      } else {
        this.refreshRoom(roomId);
      }
    });

    this.signalRService.memberPromoted$.subscribe(({ roomId }) => {
      this.refreshRoom(roomId);
    });

    this.signalRService.groupKeyRotated$.subscribe(({ roomId }) => {
  // A new version exists - drop what we've cached so the next decrypt
  // attempt re-fetches and picks up the new key too.
  this.groupKeysLoadedFor.delete(roomId);
});
  }

  private async setupEncryption(): Promise<void> {
    try {
      const publicKeyJwk = await this.cryptoService.ensureKeyPair();
      if (publicKeyJwk) {
        this.userService.updateMyPublicKey(publicKeyJwk).subscribe();
      }
    } catch (err) {
      console.error('Encryption setup failed:', err);
    }
  }

  private async decryptMessages(messages: Message[], room: ChatRoom): Promise<Message[]> {
  const currentUser = this.authService.currentUser();
  if (!currentUser) return messages;

  if (room.isGroup) {
    await this.ensureGroupKeysLoaded(room.id);
    return Promise.all(messages.map(async m => {
      const content = await this.cryptoService.decryptForGroup(room.id, m.content);
      let replyTo = m.replyTo;
      if (replyTo) {
        const replyContent = await this.cryptoService.decryptForGroup(room.id, replyTo.content);
        replyTo = { ...replyTo, content: replyContent };
      }
      return { ...m, content, replyTo };
    }));
  }

  return Promise.all(messages.map(async m => {
    const content = await this.cryptoService.decryptForRoom(room, currentUser, m.content);
    let replyTo = m.replyTo;
    if (replyTo) {
      const replyContent = await this.cryptoService.decryptForRoom(room, currentUser, replyTo.content);
      replyTo = { ...replyTo, content: replyContent };
    }
    return { ...m, content, replyTo };
  }));
}

private groupKeysLoadedFor = new Set<number>();

private async ensureGroupKeysLoaded(roomId: number): Promise<void> {
  if (this.groupKeysLoadedFor.has(roomId)) return;

  await new Promise<void>((resolve) => {
    this.chatService.getMyGroupKeys(roomId).subscribe({
      next: async (keys) => {
        const gotAtLeastOne = await this.cryptoService.loadGroupKeys(roomId, async () => keys);
       
        if (gotAtLeastOne) {
          this.groupKeysLoadedFor.add(roomId);
        } else {
          console.warn(`No group key found yet for room ${roomId} - will retry next time it's opened.`);
        }
        resolve();
      },
      error: () => resolve()
    });
  });
}

  private dropRoom(roomId: number): void {
    this.rooms.update(rooms => rooms.filter(r => r.id !== roomId));
    if (this.selectedRoom()?.id === roomId) {
      this.selectedRoom.set(null);
      this.showSidebar.set(true);
    }
  }

  private refreshRoom(roomId: number): void {
    this.chatService.getRoom(roomId).subscribe({
      next: updated => {
        this.rooms.update(rooms =>
          rooms.map(r => r.id === roomId ? updated : r)
        );
        if (this.selectedRoom()?.id === roomId) {
          this.selectedRoom.set(updated);
        }
      },
      error: () => {
        this.dropRoom(roomId);
      }
    });
  }

  async ngOnDestroy(): Promise<void> {
    await this.signalRService.stopConnection();
  }

  loadRooms(): void {
    this.chatService.getMyRooms().subscribe({
      next: rooms => {
        this.rooms.set(rooms);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  async selectRoom(room: ChatRoom): Promise<void> {
    if (this.selectedRoom()) {
      await this.signalRService.leaveRoom(this.selectedRoom()!.id);
    }

    this.signalRService.clearMessages();
    this.messages.set([]);

    this.chatService.getRoom(room.id).subscribe({
      next: fullRoom => this.selectedRoom.set(fullRoom),
      error: () => this.dropRoom(room.id)
    });

    await this.signalRService.joinRoom(room.id);

    this.chatService.getMessages(room.id).subscribe(messages => {
      const reversed = [...messages].reverse();
      this.signalRService.messages$.next(reversed);
    });

    if (window.innerWidth < 768) {
      this.showSidebar.set(false);
    }
  }

  showRoomList(): void {
    this.showSidebar.set(true);
    this.selectedRoom.set(null);
  }

  async createRoom(name: string): Promise<void> {
  this.chatService.createRoom(name, true, []).subscribe({
    next: async room => {
      this.rooms.update(rooms => [...rooms, room]);
      await this.initializeGroupKey(room);
      this.selectRoom(room);
    }
  });
}

private async initializeGroupKey(room: ChatRoom): Promise<void> {
  if (!room.isGroup) return;

  const wrapped = await this.cryptoService.createAndWrapGroupKey(room.members);
  if (!wrapped) {
    console.warn(`Could not create group key for room ${room.id} - creator has no key pair or no public keys available yet.`);
    return;
  }

  await new Promise<void>((resolve) => {
    this.chatService.distributeGroupKey(
      room.id, 1, wrapped.myPublicKeyJwk, wrapped.entries
    ).subscribe({
      next: () => resolve(),
      error: (err) => {
        console.error('Could not initialize group key:', err);
        resolve();
      }
    });
  });
}

  onDmStarted(room: ChatRoom): void {
    const exists = this.rooms().some(r => r.id === room.id);
    if (!exists) {
      this.rooms.update(rooms => [...rooms, room]);
    }
    this.selectRoom(room);
  }

  logout(): void {
    this.signalRService.stopConnection();
    this.authService.logout();
  }
}