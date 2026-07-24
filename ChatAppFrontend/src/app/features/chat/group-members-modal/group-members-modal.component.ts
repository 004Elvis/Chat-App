import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatRoom } from '../../../core/models/chat-room.model';
import { User } from '../../../core/models/user.model';
import { IconComponent } from '../../../core/components/icon/icon.component';
import { ChatService } from '../../../core/services/chat.service';

@Component({
  selector: 'app-group-members-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './group-members-modal.component.html',
  styleUrl: './group-members-modal.component.css'
})
export class GroupMembersModalComponent {
  @Input() room!: ChatRoom;
  @Input() currentUser: User | null = null;
  @Output() closed = new EventEmitter<void>();

  actionError = signal('');
  actionLoadingUserId = signal<string | null>(null);
  leavingOrDeleting = signal(false);

  constructor(private chatService: ChatService) {}

  getInitials(name: string): string {
    return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  isAdmin(member: User): boolean {
    return this.room.adminUserIds.includes(member.id);
  }

  isYou(member: User): boolean {
    return member.id === this.currentUser?.id;
  }

  get currentUserIsAdmin(): boolean {
    return !!this.currentUser && this.room.adminUserIds.includes(this.currentUser.id);
  }

  get sortedMembers(): User[] {
    return [...this.room.members].sort((a, b) => {
      const aAdmin = this.isAdmin(a);
      const bAdmin = this.isAdmin(b);
      if (aAdmin !== bAdmin) return aAdmin ? -1 : 1;
      return a.userName.localeCompare(b.userName);
    });
  }

 promote(member: User): void {
  this.actionError.set('');
  this.actionLoadingUserId.set(member.id);

  this.chatService.promoteToAdmin(this.room.id, member.id).subscribe({
    next: () => this.actionLoadingUserId.set(null),
    error: (err) => {
      this.actionError.set(err.error?.message || `Could not promote ${member.userName}.`);
      this.actionLoadingUserId.set(null);
    }
  });
}

remove(member: User): void {
  this.actionError.set('');
  this.actionLoadingUserId.set(member.id);

  this.chatService.removeMember(this.room.id, member.id).subscribe({
    next: () => this.actionLoadingUserId.set(null),
    error: (err) => {
      this.actionError.set(err.error?.message || `Could not remove ${member.userName}.`);
      this.actionLoadingUserId.set(null);
    }
  });
}

  leaveGroup(): void {
    if (!confirm(`Leave "${this.room.name}"? You'll need to be re-added to rejoin.`)) return;

    this.leavingOrDeleting.set(true);
    this.chatService.leaveRoom(this.room.id).subscribe({
      next: () => {
        this.leavingOrDeleting.set(false);
        this.close();
      },
      error: () => {
        this.actionError.set('Could not leave the group.');
        this.leavingOrDeleting.set(false);
      }
    });
  }

  deleteGroup(): void {
    if (!confirm(`Delete "${this.room.name}" permanently? This removes it for everyone and can't be undone.`)) return;

    this.leavingOrDeleting.set(true);
    this.chatService.deleteRoom(this.room.id).subscribe({
      next: () => {
        this.leavingOrDeleting.set(false);
        this.close();
      },
      error: () => {
        this.actionError.set('Could not delete the group.');
        this.leavingOrDeleting.set(false);
      }
    });
  }

  close(): void {
    this.closed.emit();
  }
}