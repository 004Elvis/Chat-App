export interface AdminUser {
  id: string;
  userName: string;
  email: string;
  avatarUrl?: string;
  isEmailVerified: boolean;
  isSiteAdmin: boolean;
  createdAt: string;
  lastSeenAt?: string;
}

export interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  totalRooms: number;
  totalGroupRooms: number;
  totalDirectMessageRooms: number;
  totalMessages: number;
}