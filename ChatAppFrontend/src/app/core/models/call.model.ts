export type CallStatus =
  | 'idle' | 'calling' | 'ringing' | 'connecting' | 'active' | 'ended';

export interface CallState {
  status: CallStatus;
  remoteUserId: string | null;
  remoteUserName: string | null;
  roomId: number | null;
  isVideo: boolean;
}

export interface CallLog {
  id: number;
  chatRoomId: number;
  roomName: string;
  isGroup: boolean;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatarUrl?: string;
  isVideo: boolean;
  wasOutgoing: boolean;
  startedAt: string;
  durationSeconds: number;
  status: 'Completed' | 'Rejected' | 'Missed' | 'Cancelled';
}