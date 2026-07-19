import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { IconComponent } from '../../../core/components/icon/icon.component';


@Component({
  selector: 'app-profile-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './profile-modal.component.html',
  styleUrl: './profile-modal.component.css'
})
export class ProfileModalComponent {
  @Output() closed = new EventEmitter<void>();

  userName = '';
  usernameError = signal('');
  usernameSaving = signal(false);
  usernameSuccess = signal('');

  avatarUploading = signal(false);
  avatarError = signal('');
  previewUrl = signal<string | null>(null);

  constructor(
    private authService: AuthService,
    private userService: UserService
  ) {
    this.userName = this.authService.currentUser()?.userName || '';
  }

  get currentUser() {
    return this.authService.currentUser();
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  validateUsername(): void {
    const val = this.userName;
    if (!val) { this.usernameError.set('Username cannot be empty.'); return; }
    if (val.length < 3) {
      this.usernameError.set('At least 3 characters required.');
      return;
    }
    if (val.length > 20) {
      this.usernameError.set('Cannot exceed 20 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(val)) {
      this.usernameError.set('Only letters, numbers, _ and - allowed.');
      return;
    }
    this.usernameError.set('');
  }

  get isUsernameValid(): boolean {
    return this.userName.length >= 3 &&
      this.userName.length <= 20 &&
      /^[a-zA-Z0-9_-]+$/.test(this.userName);
  }

  get isUnchanged(): boolean {
    return this.userName === (this.currentUser?.userName || '');
  }

  saveUsername(): void {
    this.validateUsername();
    if (!this.isUsernameValid || this.isUnchanged) return;

    this.usernameSaving.set(true);
    this.usernameSuccess.set('');
    this.usernameError.set('');

    this.userService.updateUsername(this.userName).subscribe({
      next: (res) => {
        this.authService.updateCurrentUser({ userName: res.userName });
        this.usernameSuccess.set('Username updated!');
        this.usernameSaving.set(false);
      },
      error: (err) => {
        this.usernameError.set(err.error?.message || 'Could not update username.');
        this.usernameSaving.set(false);
      }
    });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.avatarError.set('');

    if (file.size > 5 * 1024 * 1024) {
      this.avatarError.set('Image must be smaller than 5MB.');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      this.avatarError.set('Only JPG, PNG, WEBP or GIF images are allowed.');
      return;
    }

    // Instant local preview while the upload is in flight
    const reader = new FileReader();
    reader.onload = () => this.previewUrl.set(reader.result as string);
    reader.readAsDataURL(file);

    this.avatarUploading.set(true);

    this.userService.uploadAvatar(file).subscribe({
      next: (res) => {
        this.authService.updateCurrentUser({ avatarUrl: res.avatarUrl });
        this.avatarUploading.set(false);
        this.previewUrl.set(null);
      },
      error: (err) => {
        this.avatarError.set(err.error?.message || 'Upload failed. Please try again.');
        this.avatarUploading.set(false);
        this.previewUrl.set(null);
      }
    });
  }

  close(): void {
    this.closed.emit();
  }
}