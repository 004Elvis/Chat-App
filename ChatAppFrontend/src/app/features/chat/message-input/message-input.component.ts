import { Component, Output, EventEmitter, signal,
  ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../core/components/icon/icon.component';
import { EmojiPickerComponent } from '../emoji-picker/emoji-picker.component';

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [FormsModule, CommonModule, IconComponent, EmojiPickerComponent],
  templateUrl: './message-input.component.html',
  styleUrl: './message-input.component.css'
})
export class MessageInputComponent {
  @Output() messageSent = new EventEmitter<string>();
  @Output() typingChanged = new EventEmitter<boolean>();

  @ViewChild('messageTextarea') messageTextarea!: ElementRef<HTMLTextAreaElement>;

  message = '';
  isTyping = signal(false);
  showEmojiPicker = signal(false);
  private typingTimeout: any;

  onInput(): void {
    if (!this.isTyping() && this.message.trim()) {
      this.isTyping.set(true);
      this.typingChanged.emit(true);
    }

    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      if (this.isTyping()) {
        this.isTyping.set(false);
        this.typingChanged.emit(false);
      }
    }, 1500);
  }

  send(): void {
    const content = this.message.trim();
    if (!content) return;

    this.messageSent.emit(content);
    this.message = '';

    if (this.isTyping()) {
      this.isTyping.set(false);
      this.typingChanged.emit(false);
    }

    clearTimeout(this.typingTimeout);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker.set(!this.showEmojiPicker());
  }

  onEmojiSelected(emoji: string): void {
    const textarea = this.messageTextarea?.nativeElement;

    if (!textarea) {
      this.message += emoji;
      return;
    }

    const start = textarea.selectionStart ?? this.message.length;
    const end = textarea.selectionEnd ?? this.message.length;

    this.message = this.message.slice(0, start) + emoji + this.message.slice(end);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + emoji.length;
      textarea.setSelectionRange(newPos, newPos);
    });

    this.onInput();
  }
}