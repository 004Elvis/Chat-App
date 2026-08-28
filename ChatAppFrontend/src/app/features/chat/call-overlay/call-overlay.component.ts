import { Component, ElementRef, ViewChild, effect } from '@angular/core';
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

  constructor(public callService: CallService) {
    // Attaches MediaStreams to the actual <video>/<audio> elements
    // whenever they change - can't be done via [srcObject] binding
    // directly in templates, so this reactively pushes it in.
    effect(() => {
      const stream = this.callService.localStream();
      if (this.localVideoRef && stream) {
        this.localVideoRef.nativeElement.srcObject = stream;
      }
    });

    effect(() => {
      const stream = this.callService.remoteStream();
      const isVideo = this.callService.callState().isVideo;
      if (stream) {
        if (isVideo && this.remoteVideoRef) {
          this.remoteVideoRef.nativeElement.srcObject = stream;
        } else if (!isVideo && this.remoteAudioRef) {
          this.remoteAudioRef.nativeElement.srcObject = stream;
        }
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
}