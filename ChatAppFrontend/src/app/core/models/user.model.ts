export interface User {
  id: string;
  userName: string;
  email: string;
  avatarUrl?: string;
  lastSeenAt?: string;
  isEmailVerified?: boolean;
}