import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { GoogleSigninButtonModule, SocialAuthService } from '@abacritt/angularx-social-login';
import { Subscription } from 'rxjs';
import { IconComponent } from '../../../core/components/icon/icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, GoogleSigninButtonModule, IconComponent],
  templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit, OnDestroy {
  email = '';
  password = '';
  error = signal('');
  loading = signal(false);
  showPassword = signal(false);

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
          next: () => this.router.navigate(['/chat']),
          error: (err) => {
            let message = 'Google sign-in failed. Please try again.';
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

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.error.set('Please fill in all fields.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.authService.login({ email: this.email, password: this.password })
      .subscribe({
        next: () => this.router.navigate(['/chat']),
        error: () => {
          this.error.set('Invalid email or password.');
          this.loading.set(false);
        }
      });
  }
}