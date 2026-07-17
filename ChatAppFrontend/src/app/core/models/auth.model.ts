export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  userName: string;
  email: string;
}

export interface SetPasswordDto {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AuthResponse {
  token: string;
  userName: string;
  userId: string;
  avatarUrl?: string;
  isEmailVerified: boolean;
}
