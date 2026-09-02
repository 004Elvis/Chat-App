import { Injectable, signal, computed } from '@angular/core';
import { SignalRService } from './signalr.service';
import { GroupCallState, GroupCallParticipant } from '../models/call.model';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

interface PeerEntry {
  connection: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
}

@Injectable({ providedIn: 'root' })
export class GroupCallService {
  callState = signal<GroupCallState>({
    status: 'idle', roomId: null, isVideo: false, incomingCallerName: null
  });

  localStream = signal<MediaStream | null>(null);
  participants = signal<Map<string, GroupCallParticipant>>(new Map());
  isMuted = signal(false);
  isCameraOff = signal(false);
  callDurationSeconds = signal(0);

  formattedDuration = computed(() => {
    const total = this.callDurationSeconds();
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  });

  private peers = new Map<string, PeerEntry>();
  private durationTimer: any = null;
  private callStartTime: number | null = null;

  constructor(private signalRService: SignalRService) {
    this.listenForSignals();
  }

  private listenForSignals(): void {
    // Someone else started a call in a group room you're a member of -
    // shows the incoming-call screen without joining yet.
    this.signalRService.groupCallStarted$.subscribe(({ roomId, callerName, isVideo }) => {
      if (this.callState().status !== 'idle') return;
      this.callState.set({ status: 'incoming', roomId, isVideo, incomingCallerName: callerName });
    });

    // Fires right after WE join - here's everyone already in the call.
    // We initiate the offer to each of them (see joinCall for why).
    this.signalRService.existingParticipants$.subscribe(async ({ participants }) => {
      for (const p of participants) {
        await this.createOfferTo(p.userId, p.userName);
      }
    });

    // Someone new joined after us - we just wait for their offer,
    // don't initiate one ourselves (avoids both sides offering at once).
    this.signalRService.participantJoined$.subscribe(({ userId, userName }) => {
      this.upsertParticipant(userId, userName, null);
    });

    this.signalRService.participantLeft$.subscribe(({ userId }) => {
      this.removePeer(userId);
    });

    this.signalRService.callOfferReceived$.subscribe(async ({ callerId, sdp }) => {
      if (this.callState().status !== 'active') return; // only relevant mid-call
      await this.handleOffer(callerId, sdp);
    });

    this.signalRService.callAnswerReceived$.subscribe(async ({ callerId, sdp }) => {
      const peer = this.peers.get(callerId);
      if (!peer) return;
      await peer.connection.setRemoteDescription({ type: 'answer', sdp });
      await this.flushPending(callerId);
    });

    this.signalRService.iceCandidateReceived$.subscribe(async ({ callerId, candidate }) => {
      const peer = this.peers.get(callerId);
      if (!peer) return;
      const parsed = JSON.parse(candidate) as RTCIceCandidateInit;
      if (peer.connection.remoteDescription) {
        await peer.connection.addIceCandidate(parsed);
      } else {
        peer.pendingCandidates.push(parsed);
      }
    });
  }

  async startCall(roomId: number, isVideo: boolean): Promise<void> {
    if (this.callState().status !== 'idle') return;
    await this.joinCall(roomId, isVideo);
    await this.signalRService.startGroupCall(roomId, isVideo);
  }

  async acceptIncoming(): Promise<void> {
    const state = this.callState();
    if (state.status !== 'incoming' || !state.roomId) return;
    await this.joinCall(state.roomId, state.isVideo);
  }

  declineIncoming(): void {
    this.callState.set({ status: 'idle', roomId: null, isVideo: false, incomingCallerName: null });
  }

  private async joinCall(roomId: number, isVideo: boolean): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
      this.localStream.set(stream);

      this.callState.set({ status: 'active', roomId, isVideo, incomingCallerName: null });
      this.startDurationTimer();

      await this.signalRService.joinRoom(roomId);
      await this.signalRService.joinGroupCall(roomId, isVideo);
    } catch (err) {
      console.error('Could not join group call:', err);
      this.leaveCall();
    }
  }

  async leaveCall(): Promise<void> {
    const roomId = this.callState().roomId;
    if (roomId) await this.signalRService.leaveGroupCall(roomId);

    this.localStream()?.getTracks().forEach(t => t.stop());
    for (const userId of Array.from(this.peers.keys())) {
      this.removePeer(userId);
    }

    clearInterval(this.durationTimer);
    this.durationTimer = null;
    this.callStartTime = null;

    this.localStream.set(null);
    this.participants.set(new Map());
    this.isMuted.set(false);
    this.isCameraOff.set(false);
    this.callDurationSeconds.set(0);
    this.callState.set({ status: 'idle', roomId: null, isVideo: false, incomingCallerName: null });
  }

  toggleMute(): void {
    const stream = this.localStream();
    if (!stream) return;
    const next = !this.isMuted();
    stream.getAudioTracks().forEach(t => t.enabled = !next);
    this.isMuted.set(next);
  }

  toggleCamera(): void {
    const stream = this.localStream();
    if (!stream) return;
    const next = !this.isCameraOff();
    stream.getVideoTracks().forEach(t => t.enabled = !next);
    this.isCameraOff.set(next);
  }

  // --- peer connection plumbing ---

  private async createOfferTo(userId: string, userName: string): Promise<void> {
    const conn = this.createPeerConnection(userId, userName);
    const stream = this.localStream();
    if (stream) stream.getTracks().forEach(t => conn.addTrack(t, stream));

    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);
    await this.signalRService.sendCallOffer(userId, offer.sdp!, this.callState().roomId!, this.callState().isVideo);
  }

  private async handleOffer(fromUserId: string, sdp: string): Promise<void> {
    let peer = this.peers.get(fromUserId);
    if (!peer) {
      const conn = this.createPeerConnection(fromUserId, this.participants().get(fromUserId)?.userName || 'Someone');
      peer = this.peers.get(fromUserId)!;
      const stream = this.localStream();
      if (stream) stream.getTracks().forEach(t => conn.addTrack(t, stream));
    }

    await peer.connection.setRemoteDescription({ type: 'offer', sdp });
    await this.flushPending(fromUserId);

    const answer = await peer.connection.createAnswer();
    await peer.connection.setLocalDescription(answer);
    await this.signalRService.sendCallAnswer(fromUserId, answer.sdp!);
  }

  private createPeerConnection(userId: string, userName: string): RTCPeerConnection {
    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peers.set(userId, { connection, pendingCandidates: [] });
    this.upsertParticipant(userId, userName, null);

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalRService.sendIceCandidate(userId, JSON.stringify(event.candidate));
      }
    };

    connection.ontrack = (event) => {
      this.upsertParticipant(userId, userName, event.streams[0]);
    };

    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'disconnected' || connection.connectionState === 'failed') {
        this.removePeer(userId);
      }
    };

    return connection;
  }

  private async flushPending(userId: string): Promise<void> {
    const peer = this.peers.get(userId);
    if (!peer) return;
    for (const c of peer.pendingCandidates) {
      await peer.connection.addIceCandidate(c);
    }
    peer.pendingCandidates = [];
  }

  private upsertParticipant(userId: string, userName: string, stream: MediaStream | null): void {
    const map = new Map(this.participants());
    const existing = map.get(userId);
    map.set(userId, {
      userId, userName,
      stream: stream ?? existing?.stream ?? null,
      isMuted: existing?.isMuted ?? false
    });
    this.participants.set(map);
  }

  private removePeer(userId: string): void {
    const peer = this.peers.get(userId);
    peer?.connection.close();
    this.peers.delete(userId);

    const map = new Map(this.participants());
    map.delete(userId);
    this.participants.set(map);
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
}