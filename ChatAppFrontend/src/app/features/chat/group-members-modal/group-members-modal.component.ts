import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatRoom } from '../../../core/models/chat-room.model';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-group-members-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './group-members-modal.component.html',
  styleUrl: './group-members-modal.component.css'
})
export class GroupMembersModalComponent {
  @Input() room!: ChatRoom;
  @Input() currentUser: User | null = null;
  @Output() closed = new EventEmitter<void>();

  get members(): User[] {
    return this.room?.members ?? [];
  }

  close(): void {
    this.closed.emit();
  }

  getInitials(name: string): string {
    return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
}
