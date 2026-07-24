import { User } from './user.model';
import { Message } from './message.model';

export interface ChatRoom {
  id: number;
  name: string;
  isGroup: boolean;
  createdAt: string;
  members: User[];
  adminUserIds: string[];
  unreadCount: number;
  lastMessage?: Message;
}