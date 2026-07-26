import { Component, Input, Output, EventEmitter,
  OnChanges, ViewChild, ElementRef, AfterViewChecked,
  signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatRoom } from '../../../core/models/chat-room.model';
import { Message } from '../../../core/models/message.model';
import { User } from '../../../core/models/user.model';
import { SignalRService } from '../../../core/services/signalr.service';
import { MessageInputComponent } from '../message-input/message-input.component';
import { GroupMembersModalComponent } from '../group-members-modal/group-members-modal.component';
import { IconComponent } from '../../../core/components/icon/icon.component';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageInputComponent, GroupMembersModalComponent, IconComponent],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.css'
})
export class ChatWindowComponent implements OnChanges, AfterViewChecked {
  @Input() room!: ChatRoom;
  @Input() messages: Message[] = [];
  @Input() currentUser: User | null = null;
  @Input() typingUsers: string[] | null = [];
  @Input() signalRService!: SignalRService;
  @Output() backClicked = new EventEmitter<void>();

  @ViewChild('messagesEnd') messagesEnd!: ElementRef;

  shouldScroll = false;
  showMembersModal = signal(false);
  contextMenu = signal<{ message: Message; x: number; y: number } | null>(null);
  replyingTo = signal<Message | null>(null);
  private longPressTimer: any;

  ngOnChanges(): void {
    this.shouldScroll = true;
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  scrollToBottom(): void {
    try {
      this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }

  isOwnMessage(message: Message): boolean {
    return message.senderId === this.currentUser?.id;
  }

  getInitials(name: string): string {
    return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getOtherMember(): User | null {
    if (this.room.isGroup || !this.currentUser) return null;
    return this.room.members.find(m => m.id !== this.currentUser!.id) || null;
  }

  get displayName(): string {
    if (!this.room.isGroup) {
      return this.getOtherMember()?.userName || 'Unknown User';
    }
    return this.room.name;
  }

  get displayAvatar(): string | undefined {
    if (!this.room.isGroup) {
      return this.getOtherMember()?.avatarUrl;
    }
    return undefined;
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  }

  showDateSeparator(index: number): boolean {
    if (index === 0) return true;
    const current = new Date(this.messages[index].sentAt).toDateString();
    const previous = new Date(this.messages[index - 1].sentAt).toDateString();
    return current !== previous;
  }

  showSenderName(index: number, message: Message): boolean {
    if (this.isOwnMessage(message)) return false;
    if (index === 0) return true;
    return this.messages[index - 1].senderId !== message.senderId;
  }

  get typingText(): string {
    const users = this.typingUsers || [];
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0]} is typing...`;
    if (users.length === 2) return `${users[0]} and ${users[1]} are typing...`;
    return 'Several people are typing...';
  }

  async onSendMessage(content: string): Promise<void> {
    console.log('Sending message to room:', this.room?.id, 'content:', content);
    if (content.trim() && this.room) {
      const replyId = this.replyingTo()?.id;
      await this.signalRService.sendMessage(this.room.id, content, replyId);
      this.replyingTo.set(null);
    }
  }

  onMessageContextMenu(event: MouseEvent, message: Message): void {
    if (message.isDeleted) return;
    event.preventDefault();
    this.contextMenu.set({ message, x: event.clientX, y: event.clientY });
  }

  onTouchStart(event: TouchEvent, message: Message): void {
    if (message.isDeleted) return;
    const touch = event.touches[0];
    this.longPressTimer = setTimeout(() => {
      this.contextMenu.set({
        message, x: touch.clientX, y: touch.clientY
      });
    }, 500);
  }

  cancelLongPress(): void {
    clearTimeout(this.longPressTimer);
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  startReply(): void {
    const menu = this.contextMenu();
    if (!menu) return;
    this.replyingTo.set(menu.message);
    this.contextMenu.set(null);
  }

  cancelReply(): void {
    this.replyingTo.set(null);
  }

  async deleteMessage(): Promise<void> {
    const menu = this.contextMenu();
    if (!menu) return;
    await this.signalRService.deleteMessage(menu.message.id);
    this.contextMenu.set(null);
  }

  scrollToMessage(messageId: number): void {
    const el = document.getElementById('msg-' + messageId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('message-highlight');
    setTimeout(() => el.classList.remove('message-highlight'), 1500);
  }

  async onTyping(isTyping: boolean): Promise<void> {
    if (isTyping) {
      await this.signalRService.startTyping(this.room.id);
    } else {
      await this.signalRService.stopTyping(this.room.id);
    }
  }
}