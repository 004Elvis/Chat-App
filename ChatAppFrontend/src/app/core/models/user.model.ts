export interface User {
  id: string;
  userName: string;
  email: string;
  avatarUrl?: string;
  publicKey?: string;
  lastSeenAt?: string;
  isEmailVerified?: boolean;
  isSiteAdmin?: boolean;
}