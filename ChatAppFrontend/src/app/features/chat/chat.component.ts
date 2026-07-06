import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, ChatRoomListComponent, ChatWindowComponent],
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
      if (this.selectedRoom()) {
        const roomMessages = messages.filter(
          m => m.chatRoomId === this.selectedRoom()!.id
        );
        this.messages.set(roomMessages);
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

    this.selectedRoom.set(room);
    this.signalRService.clearMessages();
    this.messages.set([]);

    await this.signalRService.joinRoom(room.id);

    this.chatService.getMessages(room.id).subscribe(messages => {
      this.messages.set(messages.reverse());
      this.signalRService.messages$.next(messages.reverse());
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

  logout(): void {
    this.signalRService.stopConnection();
    this.authService.logout();
  }
}