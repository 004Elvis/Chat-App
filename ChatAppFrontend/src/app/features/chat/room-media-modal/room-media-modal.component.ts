import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../core/components/icon/icon.component';
import { ChatService } from '../../../core/services/chat.service';
import { RoomMedia } from '../../../core/models/room-media.model';

type Tab = 'images' | 'videos' | 'documents' | 'links';

@Component({
  selector: 'app-room-media-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './room-media-modal.component.html',
  styleUrl: './room-media-modal.component.css'
})
export class RoomMediaModalComponent implements OnInit {
  @Input() roomId!: number;
  @Output() closed = new EventEmitter<void>();

  activeTab = signal<Tab>('images');
  loading = signal(true);
  error = signal('');
  media = signal<RoomMedia>({ images: [], videos: [], documents: [], links: [] });

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    this.chatService.getRoomMedia(this.roomId).subscribe({
      next: (data) => {
        this.media.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load media for this conversation.');
        this.loading.set(false);
      }
    });
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString([], {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'FILE';
  }

  close(): void {
    this.closed.emit();
  }
}