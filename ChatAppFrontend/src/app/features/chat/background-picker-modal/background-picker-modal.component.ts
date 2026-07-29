import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../core/components/icon/icon.component';
import { ChatBackgroundService } from '../../../core/services/chat-background.service';
import { ChatService } from '../../../core/services/chat.service';
import { HttpEventType } from '@angular/common/http';

@Component({
  selector: 'app-background-picker-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './background-picker-modal.component.html',
  styleUrl: './background-picker-modal.component.css'
})
export class BackgroundPickerModalComponent {
  @Input() roomId!: number;
  @Output() closed = new EventEmitter<void>();
  @Output() backgroundChanged = new EventEmitter<void>();

  uploading = signal(false);
  uploadError = signal('');

  constructor(
    public bgService: ChatBackgroundService,
    private chatService: ChatService
  ) {}

  choosePreset(presetId: string): void {
    this.bgService.setPreset(this.roomId, presetId);
    this.backgroundChanged.emit();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.uploadError.set('Please choose an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.uploadError.set('Image must be smaller than 10MB.');
      return;
    }

    this.uploading.set(true);
    this.uploadError.set('');

    this.chatService.uploadAttachment(this.roomId, file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.Response && event.body) {
          this.bgService.setCustomImage(this.roomId, event.body.fileUrl);
          this.backgroundChanged.emit();
          this.uploading.set(false);
        }
      },
      error: (err) => {
        this.uploadError.set(err.error?.message || 'Upload failed. Please try again.');
        this.uploading.set(false);
      }
    });
  }

  resetBackground(): void {
    this.bgService.clear(this.roomId);
    this.backgroundChanged.emit();
  }

  close(): void {
    this.closed.emit();
  }
}