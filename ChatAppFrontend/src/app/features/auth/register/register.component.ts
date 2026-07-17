import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { GoogleSigninButtonModule, SocialAuthService } from '@abacritt/angularx-social-login';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule, GoogleSigninButtonModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit, OnDestroy {
  userName = '';
  email = '';
  error = signal('');
  loading = signal(false);
  usernameError = signal('');
  private usernameTouched = false;

  // Post-submit state: switches the form over to a "check your email" screen.
  submitted = signal(false);
  resending = signal(false);
  resendMessage = signal('');

  private authSubscription!: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
    private socialAuthService: SocialAuthService
  ) {}

  ngOnInit(): void {
    this.authSubscription = this.socialAuthService.authState.subscribe((user) => {
      if (user && user.idToken) {
        this.loading.set(true);
        this.error.set('');

        this.authService.googleLogin(user.idToken).subscribe({
          next: () => {
            this.router.navigate(['/chat']);
          },
          error: (err) => {
            let message = 'Google sign-up failed. Please try again.';
            if (err.error) {
              if (typeof err.error === 'string') message = err.error;
              else if (err.error.message) message = err.error.message;
            }
            this.error.set(message);
            this.loading.set(false);
          }
        });
      }
    });
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  onUsernameKeydown(): void {
    this.usernameTouched = true;
  }

  onEmailInput(): void {
    if (this.usernameTouched) return;

    const prefix = this.email.split('@')[0] || '';
    if (!prefix) {
      this.userName = '';
      this.validateUsername();
      return;
    }

    let suggestion = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (suggestion.length < 3) suggestion = suggestion.padEnd(3, '0');
    if (suggestion.length > 20) suggestion = suggestion.substring(0, 20);

    this.userName = suggestion;
    this.validateUsername();
  }

  validateUsername(): void {
    const val = this.userName;
    if (!val) { this.usernameError.set(''); return; }
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

  onSubmit(): void {
    if (!this.userName || !this.email) {
      this.error.set('Please fill in all fields.');
      return;
    }
    if (!this.isUsernameValid) {
      this.error.set('Please fix the username errors before submitting.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.authService.register({
      userName: this.userName,
      email: this.email
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.submitted.set(true);
      },
      error: (err) => {
        let message = 'Registration failed. Please try again.';
        if (err.error) {
          if (typeof err.error === 'string') message = err.error;
          else if (err.error.message) message = err.error.message;
        }
        this.error.set(message);
        this.loading.set(false);
      }
    });
  }

  resendLink(): void {
    this.resending.set(true);
    this.resendMessage.set('');

    this.authService.resendRegistrationLink(this.email).subscribe({
      next: (res) => {
        this.resendMessage.set(res.message || 'Link sent.');
        this.resending.set(false);
      },
      error: () => {
        this.resendMessage.set('Could not resend right now. Please try again shortly.');
        this.resending.set(false);
      }
    });
  }
}
