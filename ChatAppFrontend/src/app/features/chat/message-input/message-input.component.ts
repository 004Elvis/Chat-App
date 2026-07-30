import { Component, Output, EventEmitter, Input, signal,
  ViewChild, ElementRef, OnDestroy } from '@angular/core';
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
export class MessageInputComponent implements OnDestroy {
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

  // Voice recording state
  isRecording = signal(false);
  recordingSeconds = signal(0);
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStream: MediaStream | null = null;
  private recordingTimer: any;
  private discardRecording = false;

  constructor(private chatService: ChatService) {}

  ngOnDestroy(): void {
    this.stopStreamTracks();
    clearInterval(this.recordingTimer);
  }

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

  // ---------- Voice notes ----------

  async startRecording(): Promise<void> {
    this.uploadError.set('');

    try {
      this.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.uploadError.set('Microphone access was denied or is unavailable.');
      return;
    }

    const mimeType = this.pickSupportedMimeType();
    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.recordingStream, { mimeType })
      : new MediaRecorder(this.recordingStream);

    this.recordedChunks = [];
    this.discardRecording = false;

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      this.stopStreamTracks();
      clearInterval(this.recordingTimer);

      if (this.discardRecording || this.recordedChunks.length === 0) {
        this.recordedChunks = [];
        return;
      }

      const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
      const ext = this.extensionFor(blob.type);
      const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: blob.type });
      this.recordedChunks = [];
      this.uploadFile(file);
    };

    this.mediaRecorder.start();
    this.isRecording.set(true);
    this.recordingSeconds.set(0);
    this.recordingTimer = setInterval(() => {
      this.recordingSeconds.set(this.recordingSeconds() + 1);
    }, 1000);
  }

  stopAndSendRecording(): void {
    this.discardRecording = false;
    this.isRecording.set(false);
    this.mediaRecorder?.stop();
  }

  cancelRecording(): void {
    this.discardRecording = true;
    this.isRecording.set(false);
    this.mediaRecorder?.stop();
  }

  get formattedRecordingTime(): string {
    const total = this.recordingSeconds();
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private pickSupportedMimeType(): string | null {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];
    for (const type of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) {
        return type;
      }
    }
    return null;
  }

  private extensionFor(mimeType: string): string {
    if (mimeType.includes('mp4')) return 'm4a';
    if (mimeType.includes('ogg')) return 'ogg';
    return 'webm';
  }

  private stopStreamTracks(): void {
    this.recordingStream?.getTracks().forEach(t => t.stop());
    this.recordingStream = null;
  }
}