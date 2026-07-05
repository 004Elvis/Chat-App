export interface Message {
  id: number;
  chatRoomId: number;
  senderId: string;
  senderUserName: string;
  senderAvatarUrl?: string;
  content: string;
  messageType: string;
  sentAt: string;
  editedAt?: string;
  isDeleted: boolean;
}