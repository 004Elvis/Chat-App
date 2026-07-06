import { Component, Input, Output, EventEmitter,
  signal, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatRoom } from '../../../core/models/chat-room.model';
import { User } from '../../../core/models/user.model';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-chat-room-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-room-list.component.html',
  styleUrl: './chat-room-list.component.css'
})
export class ChatRoomListComponent implements OnChanges {
  @Input() rooms: ChatRoom[] = [];
  @Input() selectedRoom: ChatRoom | null = null;
  @Input() currentUser: User | null = null;
  @Output() roomSelected = new EventEmitter<ChatRoom>();
  @Output() roomCreated = new EventEmitter<string>();
  @Output() logoutClicked = new EventEmitter<void>();

  showCreateRoom = signal(false);
  showAddMember = signal(false);
  newRoomName = '';
  searchQuery = '';
  memberSearchQuery = '';
  searchResults = signal<User[]>([]);
  addMemberSuccess = signal('');
  addMemberError = signal('');

  constructor(private userService: UserService) {}

  ngOnChanges(): void {
    this.showAddMember.set(false);
    this.memberSearchQuery = '';
    this.searchResults.set([]);
    this.addMemberSuccess.set('');
    this.addMemberError.set('');
  }

  get filteredRooms(): ChatRoom[] {
    if (!this.searchQuery.trim()) return this.rooms;
    return this.rooms.filter(r =>
      r.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getLastMessagePreview(room: ChatRoom): string {
    if (!room.lastMessage) return 'No messages yet';
    if (room.lastMessage.isDeleted) return 'Message deleted';
    const preview = room.lastMessage.content;
    return preview.length > 35 ? preview.slice(0, 35) + '...' : preview;
  }

  formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) {
      return date.toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit'
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], {
        day: '2-digit', month: 'short'
      });
    }
  }

  createRoom(): void {
    if (this.newRoomName.trim()) {
      this.roomCreated.emit(this.newRoomName.trim());
      this.newRoomName = '';
      this.showCreateRoom.set(false);
    }
  }

  searchUsers(): void {
    if (this.memberSearchQuery.trim().length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.userService.searchUsers(this.memberSearchQuery).subscribe({
      next: users => this.searchResults.set(users),
      error: () => this.searchResults.set([])
    });
  }

  addMember(user: User): void {
    if (!this.selectedRoom) return;
    this.addMemberSuccess.set('');
    this.addMemberError.set('');

    this.userService.addMember(this.selectedRoom.id, user.id).subscribe({
      next: () => {
        this.addMemberSuccess.set(`${user.userName} added successfully!`);
        this.memberSearchQuery = '';
        this.searchResults.set([]);
      },
      error: () => {
        this.addMemberError.set(`Failed to add ${user.userName}.`);
      }
    });
  }
}