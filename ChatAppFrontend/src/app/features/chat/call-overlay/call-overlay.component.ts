import { Component, ElementRef, ViewChild, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CallService } from '../../../core/services/call.service';
import { IconComponent } from '../../../core/components/icon/icon.component';

@Component({
  selector: 'app-call-overlay',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './call-overlay.component.html',
  styleUrl: './call-overlay.component.css'
})
export class CallOverlayComponent {
  @ViewChild('localVideo') localVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteAudio') remoteAudioRef?: ElementRef<HTMLAudioElement>;

  // Elements now exist in the DOM from the start (see template), so
  // this only controls CSS visibility, not creation timing.
  showVideoUI = false;

  constructor(public callService: CallService) {
    effect(() => {
      this.showVideoUI = this.callService.callState().isVideo
        && this.callService.callState().status === 'active';
    });

    effect(() => {
      const stream = this.callService.localStream();
      if (this.localVideoRef) {
        this.localVideoRef.nativeElement.srcObject = stream;
      }
    });

    effect(() => {
      const stream = this.callService.remoteStream();
      if (this.remoteVideoRef) {
        this.remoteVideoRef.nativeElement.srcObject = stream;
      }
      if (this.remoteAudioRef) {
        this.remoteAudioRef.nativeElement.srcObject = stream;
      }
    });
  }

  async accept(): Promise<void> {
    await this.callService.acceptCall();
  }

  reject(): void {
    this.callService.rejectCall();
  }

  end(): void {
    this.callService.endCall();
  }

  toggleMute(): void {
    this.callService.toggleMute();
  }

  toggleCamera(): void {
    this.callService.toggleCamera();
  }

  toggleSpeaker(): void {
    this.callService.toggleSpeaker(this.remoteAudioRef?.nativeElement, this.remoteVideoRef?.nativeElement);
  }
}