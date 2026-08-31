import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChatService } from '../../../core/services/chat.service';
import { CallLog } from '../../../core/models/call.model';
import { IconComponent } from '../../../core/components/icon/icon.component';

@Component({
  selector: 'app-call-logs-page',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './call-logs-page.component.html',
  styleUrl: './call-logs-page.component.css'
})
export class CallLogsPageComponent implements OnInit {
  logs = signal<CallLog[]>([]);
  loading = signal(true);
  error = signal('');

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    this.chatService.getCallLogs().subscribe({
      next: logs => {
        this.logs.set(logs);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load call history.');
        this.loading.set(false);
      }
    });
  }

  getInitials(name: string): string {
    return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatDuration(seconds: number): string {
    if (seconds === 0) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  }

  callIcon(log: CallLog): 'call-outgoing' | 'call-incoming' | 'call-missed' {
    if (log.status === 'Missed' || log.status === 'Rejected') {
      return log.wasOutgoing ? 'call-outgoing' : 'call-missed';
    }
    return log.wasOutgoing ? 'call-outgoing' : 'call-incoming';
  }

  statusLabel(log: CallLog): string {
    if (log.status === 'Missed') return log.wasOutgoing ? 'No answer' : 'Missed call';
    if (log.status === 'Rejected') return log.wasOutgoing ? 'Declined' : 'You declined';
    if (log.status === 'Cancelled') return 'Cancelled';
    return this.formatDuration(log.durationSeconds);
  }
}