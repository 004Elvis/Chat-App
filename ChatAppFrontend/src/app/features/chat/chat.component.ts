import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { SignalRService } from '../../core/services/signalr.service';
import { ChatService } from '../../core/services/chat.service';
import { ChatRoom } from '../../core/models/chat-room.model';
import { Message } from '../../core/models/message.model';
import { ChatRoomListComponent } from './chat-room-list/chat-room-list.component';
import { ChatWindowComponent } from './chat-window/chat-window.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, AsyncPipe, ChatRoomListComponent, ChatWindowComponent],
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
    private chatService: ChatService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.signalRService.startConnection();
    this.loadRooms();

    this.signalRService.messages$.subscribe(messages => {
      const currentRoom = this.selectedRoom();
      if (currentRoom && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.chatRoomId === currentRoom.id) {
          this.messages.set(messages.filter(
            m => m.chatRoomId === currentRoom.id
          ));
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
      this.messages.set(reversed);
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
      next: room => {
        this.rooms.update(rooms => [...rooms, room]);
        this.selectRoom(room);
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