import { Component, Output, EventEmitter, Input, signal,
  ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { IconComponent } from '../../../core/components/icon/icon.component';
import { EmojiPickerComponent } from '../emoji-picker/emoji-picker.component';
import { ChatService, AttachmentUploadResult } from '../../../core/services/chat.service';

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [FormsModule, CommonModule, IconComponent, EmojiPickerComponent],
  templateUrl: './message-input.component.html',
  styleUrl: './message-input.component.css'
})
export class MessageInputComponent {
  @Input() roomId!: number;
  @Output() messageSent = new EventEmitter<string>();
  @Output() attachmentSent = new EventEmitter<AttachmentUploadResult>();
  @Output() typingChanged = new EventEmitter<boolean>();

  @ViewChild('messageTextarea') messageTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('mediaInput') mediaInput!: ElementRef<HTMLInputElement>;
  @ViewChild('documentInput') documentInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cameraInput') cameraInput!: ElementRef<HTMLInputElement>;

  message = '';
  isTyping = signal(false);
  showEmojiPicker = signal(false);
  showAttachMenu = signal(false);
  uploading = signal(false);
  uploadProgress = signal(0);
  uploadError = signal('');
  private typingTimeout: any;

  constructor(private chatService: ChatService) {}

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

  toggleAttachMenu(): void {
    this.showAttachMenu.set(!this.showAttachMenu());
  }

  triggerMediaPicker(): void {
    this.showAttachMenu.set(false);
    this.mediaInput.nativeElement.click();
  }

  triggerDocumentPicker(): void {
    this.showAttachMenu.set(false);
    this.documentInput.nativeElement.click();
  }

  triggerCamera(): void {
    this.showAttachMenu.set(false);
    this.cameraInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.uploadFile(file);
  }

  private uploadFile(file: File): void {
    const maxSizeBytes = 50 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      this.uploadError.set('File must be smaller than 50MB.');
      return;
    }

    this.uploading.set(true);
    this.uploadProgress.set(0);
    this.uploadError.set('');

    this.chatService.uploadAttachment(this.roomId, file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress.set(Math.round((event.loaded / event.total) * 100));
        } else if (event.type === HttpEventType.Response && event.body) {
          this.attachmentSent.emit(event.body);
          this.uploading.set(false);
          this.uploadProgress.set(0);
        }
      },
      error: (err) => {
        this.uploadError.set(err.error?.message || 'Upload failed. Please try again.');
        this.uploading.set(false);
        this.uploadProgress.set(0);
      }
    });
  }
}