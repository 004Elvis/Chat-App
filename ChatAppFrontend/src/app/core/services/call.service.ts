import { Injectable, signal } from '@angular/core';
import { SignalRService } from './signalr.service';
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

  private peerConnection: RTCPeerConnection | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];

  // The offer only gets processed once the person explicitly accepts -
  // it may arrive before or after that tap, so it's held here either
  // way until acceptCall() actually consumes it.
  private pendingOffer: { callerId: string; sdp: string } | null = null;
  private userHasAccepted = false;

  constructor(private signalRService: SignalRService) {
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
    });

    // Only ever STORES the offer - never touches media or answers on
    // its own. Processing happens exclusively inside acceptCall(),
    // which only runs after the person taps Accept.
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

    this.signalRService.callRejected$.subscribe(() => this.cleanup());
    this.signalRService.callEnded$.subscribe(() => this.cleanup());
  }

  async startCall(targetUserId: string, targetUserName: string, roomId: number, isVideo: boolean): Promise<void> {
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

  // Called when the person taps "Accept" - this is the ONLY path that
  // requests mic/camera access and answers, and only ever after
  // explicit user action.
  async acceptCall(): Promise<void> {
    this.userHasAccepted = true;
    this.callState.update(s => ({ ...s, status: 'connecting' }));

    if (this.pendingOffer) {
      await this.processAcceptedCall();
    }
    // If the offer hasn't arrived yet, processAcceptedCall() will run
    // automatically the moment callOfferReceived$ fires, since
    // userHasAccepted is now true.
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
    } catch (err) {
      console.error('Could not answer call:', err);
      this.cleanup();
    }
  }

  async rejectCall(): Promise<void> {
    const remoteId = this.callState().remoteUserId;
    if (remoteId) await this.signalRService.rejectCall(remoteId);
    this.cleanup();
  }

  async endCall(): Promise<void> {
    const remoteId = this.callState().remoteUserId;
    if (remoteId) await this.signalRService.endCall(remoteId);
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
    this.callState.set({
      status: 'idle', remoteUserId: null, remoteUserName: null,
      roomId: null, isVideo: false
    });
  }
}