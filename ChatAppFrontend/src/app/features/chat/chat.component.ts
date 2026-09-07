import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';

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
  imports: [
    CommonModule,
    AsyncPipe,
    ChatRoomListComponent,
    ChatWindowComponent,
    IconComponent,
    CallOverlayComponent
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css'
})
export class ChatComponent implements OnInit, OnDestroy {
  rooms = signal<ChatRoom[]>([]);
  selectedRoom = signal<ChatRoom | null>(null);
  messages = signal<Message[]>([]);
  loading = signal(true);
  showSidebar = signal(true);

  private groupKeysLoadedFor = new Set<number>();

  constructor(
    public authService: AuthService,
    public signalRService: SignalRService,
    private chatService: ChatService,
    private userService: UserService,
    private cryptoService: CryptoService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.setupEncryption();
    await this.signalRService.startConnection();

    this.loadRooms();
    this.setupSignalRListeners();
  }

  private setupSignalRListeners(): void {
    this.signalRService.messages$.subscribe(async messages => {
      const currentRoom = this.selectedRoom();

      if (!currentRoom || messages.length === 0) return;

      const roomMessages = messages.filter(
        message => message.chatRoomId === currentRoom.id
      );

      if (roomMessages.length === 0) return;

      const decrypted = await this.decryptMessages(roomMessages, currentRoom);
      this.messages.set(decrypted);
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

    this.signalRService.groupKeyRotated$.subscribe(async ({ roomId }) => {
      this.groupKeysLoadedFor.delete(roomId);
      await this.ensureGroupKeysLoaded(roomId);
    });
  }

  private async setupEncryption(): Promise<void> {
    try {
      const publicKeyJwk = await this.cryptoService.ensureKeyPair();

      if (publicKeyJwk) {
        await firstValueFrom(
          this.userService.updateMyPublicKey(publicKeyJwk)
        );
      }
    } catch (error) {
      console.error('Encryption setup failed:', error);
    }
  }

  private async decryptMessages(
    messages: Message[],
    room: ChatRoom
  ): Promise<Message[]> {
    const currentUser = this.authService.currentUser();

    if (!currentUser) return messages;

    if (room.isGroup) {
      await this.ensureGroupKeysLoaded(room.id);

      if (!this.cryptoService.hasGroupKey(room.id)) {
        console.warn(`No group key available for room ${room.id}`);
        return messages;
      }

      return Promise.all(
        messages.map(async message => {
          const content = await this.cryptoService.decryptForGroup(
            room.id,
            message.content
          );

          let replyTo = message.replyTo;

          if (replyTo) {
            const replyContent = await this.cryptoService.decryptForGroup(
              room.id,
              replyTo.content
            );

            replyTo = { ...replyTo, content: replyContent };
          }

          return { ...message, content, replyTo };
        })
      );
    }

    return Promise.all(
      messages.map(async message => {
        const content = await this.cryptoService.decryptForRoom(
          room,
          currentUser,
          message.content
        );

        let replyTo = message.replyTo;

        if (replyTo) {
          const replyContent = await this.cryptoService.decryptForRoom(
            room,
            currentUser,
            replyTo.content
          );

          replyTo = { ...replyTo, content: replyContent };
        }

        return { ...message, content, replyTo };
      })
    );
  }

  private async ensureGroupKeysLoaded(roomId: number): Promise<void> {
    if (this.groupKeysLoadedFor.has(roomId)) return;

    try {
      const keys = await firstValueFrom(
        this.chatService.getMyGroupKeys(roomId)
      );

      const gotAtLeastOne = await this.cryptoService.loadGroupKeys(
        roomId,
        async () => keys
      );

      if (gotAtLeastOne) {
        this.groupKeysLoadedFor.add(roomId);
      } else {
        console.warn(`No usable group key found for room ${roomId}`);
      }
    } catch (error) {
      console.error(`Failed to load group keys for room ${roomId}`, error);
    }
  }

  private dropRoom(roomId: number): void {
    this.rooms.update(rooms => rooms.filter(room => room.id !== roomId));
    this.groupKeysLoadedFor.delete(roomId);

    if (this.selectedRoom()?.id === roomId) {
      this.selectedRoom.set(null);
      this.messages.set([]);
      this.showSidebar.set(true);
    }
  }

  private refreshRoom(roomId: number): void {
    this.chatService.getRoom(roomId).subscribe({
      next: updatedRoom => {
        this.rooms.update(rooms =>
          rooms.map(room =>
            room.id === roomId ? updatedRoom : room
          )
        );

        if (this.selectedRoom()?.id === roomId) {
          this.selectedRoom.set(updatedRoom);
        }
      },
      error: () => this.dropRoom(roomId)
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
    const previousRoom = this.selectedRoom();

    if (previousRoom && previousRoom.id !== room.id) {
      await this.signalRService.leaveRoom(previousRoom.id);
    }

    this.signalRService.clearMessages();
    this.messages.set([]);

    try {
      const fullRoom = await firstValueFrom(
        this.chatService.getRoom(room.id)
      );

      this.selectedRoom.set(fullRoom);

      if (fullRoom.isGroup) {
        await this.ensureGroupKeysLoaded(fullRoom.id);
      }

      await this.signalRService.joinRoom(fullRoom.id);

      const messages = await firstValueFrom(
        this.chatService.getMessages(fullRoom.id)
      );

      this.signalRService.messages$.next([...messages].reverse());

      if (window.innerWidth < 768) {
        this.showSidebar.set(false);
      }
    } catch (error) {
      console.error('Could not select room:', error);
      this.dropRoom(room.id);
    }
  }

  showRoomList(): void {
    this.showSidebar.set(true);
    this.selectedRoom.set(null);
  }

  async createRoom(name: string): Promise<void> {
  this.chatService.createRoom(name, true, []).subscribe({
    next: room => {
      this.chatService.getRoom(room.id).subscribe({
        next: async fullRoom => {
          this.rooms.update(rooms => [...rooms, fullRoom]);

          await this.initializeGroupKey(fullRoom);

          this.selectRoom(fullRoom);
        },
        error: err => {
          console.error(
            'Could not load newly created room:',
            err
          );
        }
      });
    },
    error: err => {
      console.error(
        'Could not create group:',
        err
      );
    }
  });
}

 private async initializeGroupKey(
  room: ChatRoom
): Promise<void> {
  if (!room.isGroup) return;

  console.log(
    'Initializing group key for members:',
    room.members.map(member => ({
      id: member.id,
      userName: member.userName,
      hasPublicKey: !!member.publicKey
    }))
  );

  const wrapped =
    await this.cryptoService.createAndWrapGroupKey(
      room.members
    );

  if (!wrapped) {
    console.error(
      `Could not initialize group encryption for room ${room.id}. Every member must have a public key.`
    );

    return;
  }

  this.chatService.distributeGroupKey(
    room.id,
    1,
    wrapped.myPublicKeyJwk,
    wrapped.entries
  ).subscribe({
    next: () => {
      console.log(
        `Group key successfully distributed to ${wrapped.entries.length} members.`
      );

      this.groupKeysLoadedFor.delete(room.id);
    },
    error: err => {
      console.error(
        'Could not initialize group key:',
        err
      );
    }
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