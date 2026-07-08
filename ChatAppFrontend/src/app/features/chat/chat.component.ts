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

  // Reload full room details to get updated member count
  this.chatService.getRoom(room.id).subscribe(fullRoom => {
    this.selectedRoom.set(fullRoom);
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

  logout(): void {
    this.signalRService.stopConnection();
    this.authService.logout();
  }
}