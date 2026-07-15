import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './verify-email.component.html'
})
export class VerifyEmailComponent implements OnInit {
  status = signal<'checking' | 'success' | 'error'>('checking');
  message = signal('');

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.status.set('error');
      this.message.set('This verification link is missing its token.');
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: (res) => {
        this.status.set('success');
        this.message.set(res.message || 'Email verified successfully!');
        // If the person is currently logged in on this device/browser,
        // reflect the verified state immediately without needing a fresh login.
        this.authService.markEmailVerified();
      },
      error: (err) => {
        this.status.set('error');
        this.message.set(
          err.error?.message || 'This verification link is invalid or has expired.'
        );
      }
    });
  }
}
