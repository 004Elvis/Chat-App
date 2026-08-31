import { Injectable, signal, computed } from '@angular/core';
import { SignalRService } from './signalr.service';
import { ChatService } from './chat.service';
import { CallState } from '../models/call.model';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

@Injectable({ providedIn: 'root' })
export class CallService {
  callState = signal<CallState>({
    status: 'idle', remoteUserId: null, remoteUserName: null,
    roomId: null, isVideo: false
  });

  localStream = signal<MediaStream | null>(null);
  remoteStream = signal<MediaStream | null>(null);
  isMuted = signal(false);
  isCameraOff = signal(false);
  callDurationSeconds = signal(0);
  isSpeakerOn = signal(false);

  formattedDuration = computed(() => {
    const total = this.callDurationSeconds();
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  });

  private peerConnection: RTCPeerConnection | null = null;
  private durationTimer: any = null;
  private callStartTime: number | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private pendingOffer: { callerId: string; sdp: string } | null = null;
  private userHasAccepted = false;
  private wasEverActive = false;
  private wasCaller = false;

  constructor(
    private signalRService: SignalRService,
    private chatService: ChatService
  ) {
    this.listenForIncomingSignals();
  }

  private listenForIncomingSignals(): void {
    this.signalRService.incomingCall$.subscribe(async ({ callerId, callerName, roomId, isVideo }) => {
      if (this.callState().status !== 'idle') {
        await this.signalRService.rejectCall(callerId);
        return;
      }
      this.userHasAccepted = false;
      this.pendingOffer = null;
      this.callState.set({
        status: 'ringing', remoteUserId: callerId,
        remoteUserName: callerName, roomId, isVideo
      });
      this.wasCaller = false;
    });

    this.signalRService.callOfferReceived$.subscribe(({ callerId, sdp }) => {
      this.pendingOffer = { callerId, sdp };
      if (this.userHasAccepted) {
        this.processAcceptedCall();
      }
    });

    this.signalRService.callAnswerReceived$.subscribe(async ({ sdp }) => {
      if (!this.peerConnection) return;
      await this.peerConnection.setRemoteDescription({ type: 'answer', sdp });
      this.callState.update(s => ({ ...s, status: 'active' }));
      this.wasEverActive = true;
      this.startDurationTimer();
      await this.flushPendingIceCandidates();
    });

    this.signalRService.iceCandidateReceived$.subscribe(async ({ candidate }) => {
      const parsed = JSON.parse(candidate) as RTCIceCandidateInit;
      if (this.peerConnection?.remoteDescription) {
        await this.peerConnection.addIceCandidate(parsed);
      } else {
        this.pendingIceCandidates.push(parsed);
      }
    });

    this.signalRService.callRejected$.subscribe(() => {
      const state = this.callState();
      this.reportOutcome(state, 'Rejected');
      this.cleanup();
    });

    this.signalRService.callEnded$.subscribe(() => {
      const state = this.callState();
      this.reportOutcome(state, this.wasEverActive ? 'Completed' : 'Missed');
      this.cleanup();
    });
  }

  
  private reportOutcome(state: CallState, status: string): void {
    if (!this.wasCaller || !state.remoteUserId || !state.roomId) return;

    this.chatService.logCall(
      state.roomId, state.remoteUserId, state.isVideo,
      this.callDurationSeconds(), status
    ).subscribe({
      error: (err) => console.error('Could not log call:', err)
    });
  }

  private startDurationTimer(): void {
    this.callStartTime = Date.now();
    this.callDurationSeconds.set(0);
    this.durationTimer = setInterval(() => {
      if (this.callStartTime) {
        this.callDurationSeconds.set(Math.floor((Date.now() - this.callStartTime) / 1000));
      }
    }, 1000);
  }

  async startCall(targetUserId: string, targetUserName: string, roomId: number, isVideo: boolean): Promise<void> {
    this.wasEverActive = false;
    this.wasCaller = true;
    if (this.callState().status !== 'idle') return;

    this.callState.set({
      status: 'calling', remoteUserId: targetUserId,
      remoteUserName: targetUserName, roomId, isVideo
    });

    await this.signalRService.callUser(targetUserId, roomId, isVideo);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
      this.localStream.set(stream);

      this.createPeerConnection(targetUserId);
      stream.getTracks().forEach(track => this.peerConnection!.addTrack(track, stream));

      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);

      await this.signalRService.sendCallOffer(targetUserId, offer.sdp!, roomId, isVideo);
    } catch (err) {
      console.error('Could not start call:', err);
      this.cleanup();
    }
  }

  async acceptCall(): Promise<void> {
    this.wasEverActive = false;
    this.userHasAccepted = true;
    this.callState.update(s => ({ ...s, status: 'connecting' }));

    if (this.pendingOffer) {
      await this.processAcceptedCall();
    }
  }

  async toggleSpeaker(audioEl?: HTMLAudioElement, videoEl?: HTMLVideoElement): Promise<void> {
    const next = !this.isSpeakerOn();
    const targets = [audioEl, videoEl].filter(Boolean) as (HTMLAudioElement | HTMLVideoElement)[];

    for (const el of targets) {
      const anyEl = el as any;
      if (typeof anyEl.setSinkId === 'function') {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const speaker = devices.find(d =>
            d.kind === 'audiooutput' && /speaker/i.test(d.label)
          );
          await anyEl.setSinkId(next ? (speaker?.deviceId || 'default') : 'default');
        } catch (err) {
          console.warn('setSinkId not permitted or failed:', err);
        }
      }
    }

    this.isSpeakerOn.set(next);
  }

  private async processAcceptedCall(): Promise<void> {
    const offer = this.pendingOffer;
    if (!offer) return;
    this.pendingOffer = null;

    const isVideo = this.callState().isVideo;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
      this.localStream.set(stream);

      this.createPeerConnection(offer.callerId);
      stream.getTracks().forEach(track => this.peerConnection!.addTrack(track, stream));

      await this.peerConnection!.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
      await this.flushPendingIceCandidates();

      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);

      await this.signalRService.sendCallAnswer(offer.callerId, answer.sdp!);
      this.callState.update(s => ({ ...s, status: 'active' }));
      this.wasEverActive = true;
      this.startDurationTimer();
    } catch (err) {
      console.error('Could not answer call:', err);
      this.cleanup();
    }
  }

  async rejectCall(): Promise<void> {
    const state = this.callState();
    const remoteId = state.remoteUserId;

    if (remoteId) await this.signalRService.rejectCall(remoteId);

    this.reportOutcome(state, 'Rejected');
    this.cleanup();
  }

  async endCall(): Promise<void> {
    const state = this.callState();
    const remoteId = state.remoteUserId;

    if (remoteId) await this.signalRService.endCall(remoteId);
    this.reportOutcome(state, this.wasEverActive ? 'Completed' : 'Cancelled');

    this.cleanup();
  }

  toggleMute(): void {
    const stream = this.localStream();
    if (!stream) return;
    const nextMuted = !this.isMuted();
    stream.getAudioTracks().forEach(t => t.enabled = !nextMuted);
    this.isMuted.set(nextMuted);
  }

  toggleCamera(): void {
    const stream = this.localStream();
    if (!stream) return;
    const nextOff = !this.isCameraOff();
    stream.getVideoTracks().forEach(t => t.enabled = !nextOff);
    this.isCameraOff.set(nextOff);
  }

  private createPeerConnection(remoteUserId: string): void {
    this.peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalRService.sendIceCandidate(remoteUserId, JSON.stringify(event.candidate));
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteStream.set(event.streams[0]);
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection?.connectionState === 'disconnected' ||
          this.peerConnection?.connectionState === 'failed') {
        this.cleanup();
      }
    };
  }

  private async flushPendingIceCandidates(): Promise<void> {
    for (const candidate of this.pendingIceCandidates) {
      await this.peerConnection?.addIceCandidate(candidate);
    }
    this.pendingIceCandidates = [];
  }

  private cleanup(): void {
    clearInterval(this.durationTimer);
    this.durationTimer = null;
    this.localStream()?.getTracks().forEach(t => t.stop());
    this.peerConnection?.close();
    this.peerConnection = null;
    this.pendingIceCandidates = [];
    this.pendingOffer = null;
    this.userHasAccepted = false;

    this.localStream.set(null);
    this.remoteStream.set(null);
    this.isMuted.set(false);
    this.isCameraOff.set(false);
    this.callDurationSeconds.set(0);
    this.isSpeakerOn.set(false);
    this.callStartTime = null;
    this.callState.set({
      status: 'idle', remoteUserId: null, remoteUserName: null,
      roomId: null, isVideo: false
    });
  }
}