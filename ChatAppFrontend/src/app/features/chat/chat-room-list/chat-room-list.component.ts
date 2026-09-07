import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  OnInit,
  OnChanges
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ChatRoom } from '../../../core/models/chat-room.model';
import { User } from '../../../core/models/user.model';

import { UserService } from '../../../core/services/user.service';
import { ChatService } from '../../../core/services/chat.service';
import { CryptoService } from '../../../core/services/crypto.service';

import { IconComponent } from '../../../core/components/icon/icon.component';
import { SettingsMenuComponent } from '../settings-menu/settings-menu.component';


@Component({
  selector: 'app-chat-room-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    SettingsMenuComponent
  ],
  templateUrl: './chat-room-list.component.html',
  styleUrls: ['./chat-room-list.component.css']
})
export class ChatRoomListComponent implements OnInit {
  @Input() rooms: ChatRoom[] = [];
  @Input() selectedRoom: ChatRoom | null = null;
  @Input() currentUser: User | null = null;
  @Input() currentUserIsAdmin: boolean = false;

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

  showNewDm = signal(false);
  dmSearchQuery = '';
  dmSearchResults = signal<User[]>([]);
  dmError = signal('');
  dmStarting = signal(false);

  constructor(
    private userService: UserService,
    private chatService: ChatService,
    private cryptoService: CryptoService
  ) {}

  ngOnInit(): void {
    this.showAddMember.set(false);
    this.memberSearchQuery = '';
    this.searchResults.set([]);
    this.addMemberSuccess.set('');
    this.addMemberError.set('');

    if (this.currentUserIsAdmin) {
      this.repairMissingKeys();
    }
  }

  private async repairMissingKeys(): Promise<void> {
    if (!this.selectedRoom) return;
    const room = this.selectedRoom;

    try {
      const versionInfo = await firstValueFrom(
        this.chatService.getGroupKeyVersionInfo(room.id)
      );
      if (versionInfo.latestVersion === 0) return;

      const missingMembers = room.members.filter(
        m => !versionInfo.memberUserIdsWithKey.includes(m.id)
      );
      if (missingMembers.length === 0) return;

      if (!this.cryptoService.hasGroupKey(room.id)) {
        const keys = await firstValueFrom(this.chatService.getMyGroupKeys(room.id));
        await this.cryptoService.loadGroupKeys(room.id, async () => keys);
      }
      if (!this.cryptoService.hasGroupKey(room.id)) return;

      const myPublicKeyJwk = await this.cryptoService.getMyPublicKeyJwk();
      if (!myPublicKeyJwk) return;

      const entries: { userId: string; encryptedKey: string }[] = [];
      for (const member of missingMembers) {
        const wrapped = await this.cryptoService
          .wrapExistingGroupKeyForNewMember(room.id, member);
        if (wrapped) entries.push(wrapped);
      }

      if (entries.length > 0) {
        await firstValueFrom(
          this.chatService.distributeGroupKey(
            room.id, versionInfo.latestVersion, myPublicKeyJwk, entries
          )
        );
        console.log(`Repaired group key access for ${entries.length} member(s).`);
      }
    } catch (err) {
      console.error('Key repair failed:', err);
    }
  }

  get filteredRooms(): ChatRoom[] {
    if (!this.searchQuery.trim()) return this.rooms;

    return this.rooms.filter(room =>
      this.getRoomDisplayName(room)
        .toLowerCase()
        .includes(this.searchQuery.toLowerCase())
    );
  }

  getInitials(name: string): string {
    return (name || 'U')
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getOtherMember(room: ChatRoom): User | null {
    if (room.isGroup || !this.currentUser) return null;

    return room.members.find(
      member => member.id !== this.currentUser!.id
    ) || null;
  }

  getRoomDisplayName(room: ChatRoom): string {
    if (!room.isGroup) {
      return this.getOtherMember(room)?.userName || 'Unknown User';
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

    const message = room.lastMessage;

    if (!message.content) {
      if (message.messageType === 'Image') return '📷 Photo';
      if (message.messageType === 'Video') return '🎥 Video';
      if (message.messageType === 'VoiceNote') return '🎤 Voice message';
      if (message.messageType === 'Document') return '📄 Document';
    }

    if (
      message.content &&
      message.content.startsWith('e2e1:')
    ) {
      return '🔒 Encrypted message';
    }

    return message.content.length > 35
      ? message.content.slice(0, 35) + '...'
      : message.content;
  }

  formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();

    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    if (days === 1) return 'Yesterday';

    if (days < 7) {
      return date.toLocaleDateString([], {
        weekday: 'short'
      });
    }

    return date.toLocaleDateString([], {
      day: '2-digit',
      month: 'short'
    });
  }

  createRoom(): void {
    if (!this.newRoomName.trim()) return;

    this.roomCreated.emit(this.newRoomName.trim());

    this.newRoomName = '';
    this.showCreateRoom.set(false);
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

  async addMember(user: User): Promise<void> {
    if (!this.selectedRoom) return;

    this.addMemberSuccess.set('');
    this.addMemberError.set('');

    const roomId = this.selectedRoom.id;

    try {
      await firstValueFrom(
        this.userService.addMember(roomId, user.id)
      );

      this.addMemberSuccess.set(
        `${user.userName} added successfully!`
      );

      this.memberSearchQuery = '';
      this.searchResults.set([]);

      await this.shareExistingKeyWithNewMember(roomId, user);

    } catch (error) {
      console.error('Could not add member:', error);

      this.addMemberError.set(
        `Failed to add ${user.userName}.`
      );
    }
  }

  private async shareExistingKeyWithNewMember(roomId: number, newMember: User): Promise<void> {
    try {
      const versionInfo = await firstValueFrom(
        this.chatService.getGroupKeyVersionInfo(roomId)
      );

      if (versionInfo.latestVersion === 0) return; // group has no key at all yet

      if (!this.cryptoService.hasGroupKey(roomId)) {
        const keys = await firstValueFrom(this.chatService.getMyGroupKeys(roomId));
        await this.cryptoService.loadGroupKeys(roomId, async () => keys);
      }
      if (!this.cryptoService.hasGroupKey(roomId)) return;

      const wrappedEntry = await this.cryptoService
        .wrapExistingGroupKeyForNewMember(roomId, newMember);
      if (!wrappedEntry) return;

      const myPublicKeyJwk = await this.cryptoService.getMyPublicKeyJwk();
      if (!myPublicKeyJwk) return;

      await firstValueFrom(
        this.chatService.distributeGroupKey(
          roomId, versionInfo.latestVersion, myPublicKeyJwk, [wrappedEntry]
        )
      );
    } catch (err) {
      console.error('Could not share group key with new member:', err);
    }
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
      next: room => {
        this.dmStarting.set(false);
        this.showNewDm.set(false);

        this.dmSearchQuery = '';
        this.dmSearchResults.set([]);

        this.dmStarted.emit(room);
      },

      error: () => {
        this.dmStarting.set(false);

        this.dmError.set(
          `Could not start a conversation with ${user.userName}.`
        );
      }
    });
  }
}