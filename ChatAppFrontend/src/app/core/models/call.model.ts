export type CallStatus =
  | 'idle' | 'calling' | 'ringing' | 'connecting' | 'active' | 'ended';

export interface CallState {
  status: CallStatus;
  remoteUserId: string | null;
  remoteUserName: string | null;
  roomId: number | null;
  isVideo: boolean;
}