import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatRoom } from '../../../core/models/chat-room.model';
import { User } from '../../../core/models/user.model';
import { IconComponent } from '../../../core/components/icon/icon.component';
import { ChatService } from '../../../core/services/chat.service';
import { CryptoService } from '../../../core/services/crypto.service';

@Component({
  selector: 'app-group-members-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './group-members-modal.component.html',
  styleUrl: './group-members-modal.component.css'
})
export class GroupMembersModalComponent implements OnInit {
  @Input() room!: ChatRoom;
  @Input() currentUser: User | null = null;
  @Output() closed = new EventEmitter<void>();

  actionError = signal('');
  actionLoadingUserId = signal<string | null>(null);
  leavingOrDeleting = signal(false);

  constructor(
    private chatService: ChatService,
    private cryptoService: CryptoService
  ) {}

  getInitials(name: string): string {
    return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  isAdmin(member: User): boolean {
    return this.room.adminUserIds.includes(member.id);
  }

  isYou(member: User): boolean {
    return member.id === this.currentUser?.id;
  }

  ngOnInit(): void {
  if (this.currentUserIsAdmin) {
    this.repairMissingKeys();
  }
}

private async repairMissingKeys(): Promise<void> {
  this.chatService.getGroupKeyVersionInfo(this.room.id).subscribe({
    next: async (info) => {
      if (info.latestVersion === 0) return;

      if (!this.cryptoService.hasGroupKey(this.room.id)) {
        await new Promise<void>((resolve) => {
          this.chatService.getMyGroupKeys(this.room.id).subscribe({
            next: async (keys) => {
              await this.cryptoService.loadGroupKeys(this.room.id, async () => keys);
              resolve();
            },
            error: () => resolve()
          });
        });
      }
      if (!this.cryptoService.hasGroupKey(this.room.id)) return;

      const myPublicKeyJwk = await this.cryptoService.getMyPublicKeyJwk();
      if (!myPublicKeyJwk) return;

      // Re-wrap for EVERY current member, not just ones that appear to
      // be missing an entry - an entry can exist but be silently
      // unusable if that person's device generated a new key pair
      // since it was last wrapped. The backend now upserts, so this is
      // always safe to run.
      const entries: { userId: string; encryptedKey: string }[] = [];
      for (const member of this.room.members) {
        const wrapped = await this.cryptoService
          .wrapExistingGroupKeyForNewMember(this.room.id, member);
        if (wrapped) entries.push(wrapped);
      }

      if (entries.length > 0) {
        this.chatService.distributeGroupKey(
          this.room.id, info.latestVersion, myPublicKeyJwk, entries
        ).subscribe({
          error: (err) => console.error('Key repair failed:', err)
        });
      }
    },
    error: () => {}
  });
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
      next: () => {
        this.actionLoadingUserId.set(null);
        // Someone was just removed - rotate the group key so they
        // can't decrypt anything sent from this point forward.
        this.rotateGroupKey(member.id);
      },
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

  // Generates a fresh group key and distributes it to everyone except
  // the departed member. Fails silently from the user's point of view -
  // the remove/leave action itself already succeeded regardless of
  // whether re-keying works, since correctness of membership matters
  // more than encryption continuity in an edge-case failure.
  private rotateGroupKey(excludeUserId: string): void {
    const remainingMembers = this.room.members.filter(m => m.id !== excludeUserId);

    this.chatService.getGroupKeyVersionInfo(this.room.id).subscribe({
      next: async (info) => {
        const wrapped = await this.cryptoService.createAndWrapGroupKey(remainingMembers);
        if (!wrapped) return;

        this.chatService.distributeGroupKey(
          this.room.id,
          info.latestVersion + 1,
          wrapped.myPublicKeyJwk,
          wrapped.entries
        ).subscribe({
          error: (err) => console.error('Group key rotation failed:', err)
        });
      },
      error: (err) => console.error('Could not fetch key version info:', err)
    });
  }

  close(): void {
    this.closed.emit();
  }
}