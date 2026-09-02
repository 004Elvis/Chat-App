import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GroupCallService } from '../../../core/services/group-call.service';
import { IconComponent } from '../../../core/components/icon/icon.component';
import { VideoStreamDirective } from './video-stream.directive';

@Component({
  selector: 'app-group-call-overlay',
  standalone: true,
  imports: [CommonModule, IconComponent, VideoStreamDirective],
  templateUrl: './group-call-overlay.component.html',
  styleUrl: './group-call-overlay.component.css'
})
export class GroupCallOverlayComponent {
  constructor(public callService: GroupCallService) {}

  get participantList() {
    return Array.from(this.callService.participants().values());
  }

  getInitials(name: string): string {
    return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  accept(): void {
    this.callService.acceptIncoming();
  }

  decline(): void {
    this.callService.declineIncoming();
  }

  leave(): void {
    this.callService.leaveCall();
  }

  toggleMute(): void {
    this.callService.toggleMute();
  }

  toggleCamera(): void {
    this.callService.toggleCamera();
  }
}