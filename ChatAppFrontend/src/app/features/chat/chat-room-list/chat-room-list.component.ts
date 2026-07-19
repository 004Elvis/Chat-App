import { Component, Input, Output, EventEmitter,
  signal, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatRoom } from '../../../core/models/chat-room.model';
import { User } from '../../../core/models/user.model';
import { UserService } from '../../../core/services/user.service';
import { ChatService } from '../../../core/services/chat.service';
import { IconComponent } from '../../../core/components/icon/icon.component';
import { SettingsMenuComponent } from '../settings-menu/settings-menu.component';

@Component({
  selector: 'app-chat-room-list',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, SettingsMenuComponent],
  templateUrl: './chat-room-list.component.html',
  styleUrls: ['./chat-room-list.component.css']
})
export class ChatRoomListComponent implements OnChanges {
  @Input() rooms: ChatRoom[] = [];
  @Input() selectedRoom: ChatRoom | null = null;
  @Input() currentUser: User | null = null;
  @Output() roomSelected = new EventEmitter<ChatRoom>();
  @Output() roomCreated = new EventEmitter<string>();
  @Output() dmStarted = new EventEmitter<ChatRoom>();
  @Output() logoutClicked = new EventEmitter<void>();

  showCreateRoom = signal(false);
  showAddMember = signal(false);
  newRoomName = '';
  searchQuery = '';
  memberSearchQuery = '';
  searchResults = signal<User[]>([]);
  addMemberSuccess = signal('');
  addMemberError = signal('');

  // Separate state for "start a new DM" so it never mixes with the
  // "add member to this group" flow above.
  showNewDm = signal(false);
  dmSearchQuery = '';
  dmSearchResults = signal<User[]>([]);
  dmError = signal('');
  dmStarting = signal(false);

  constructor(
    private userService: UserService,
    private chatService: ChatService
  ) {}

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
      this.getRoomDisplayName(r).toLowerCase()
        .includes(this.searchQuery.toLowerCase())
    );
  }

  getInitials(name: string): string {
    return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  // For a group room, the room has its own name. For a DM, there's no
  // room name at all - we show whichever member isn't the current user.
  getOtherMember(room: ChatRoom): User | null {
    if (room.isGroup || !this.currentUser) return null;
    return room.members.find(m => m.id !== this.currentUser!.id) || null;
  }

  getRoomDisplayName(room: ChatRoom): string {
    if (!room.isGroup) {
      const other = this.getOtherMember(room);
      return other?.userName || 'Unknown User';
    }
    return room.name;
  }

  getRoomDisplayAvatar(room: ChatRoom): string | undefined {
    if (!room.isGroup) {
      return this.getOtherMember(room)?.avatarUrl;
    }
    return undefined;
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

  toggleNewDm(): void {
    this.showNewDm.set(!this.showNewDm());
    this.dmSearchQuery = '';
    this.dmSearchResults.set([]);
    this.dmError.set('');
  }

  searchDmUsers(): void {
    if (this.dmSearchQuery.trim().length < 2) {
      this.dmSearchResults.set([]);
      return;
    }
    this.userService.searchUsers(this.dmSearchQuery).subscribe({
      next: users => this.dmSearchResults.set(users),
      error: () => this.dmSearchResults.set([])
    });
  }

  startDm(user: User): void {
    this.dmStarting.set(true);
    this.dmError.set('');

    this.chatService.startDirectMessage(user.id).subscribe({
      next: (room) => {
        this.dmStarting.set(false);
        this.showNewDm.set(false);
        this.dmSearchQuery = '';
        this.dmSearchResults.set([]);
        this.dmStarted.emit(room);
      },
      error: () => {
        this.dmStarting.set(false);
        this.dmError.set(`Could not start a conversation with ${user.userName}.`);
      }
    });
  }
}