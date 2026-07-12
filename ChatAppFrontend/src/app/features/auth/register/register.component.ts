import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  userName = '';
  email = '';
  password = '';
  error = signal('');
  loading = signal(false);
  usernameError = signal('');

  constructor(private authService: AuthService, private router: Router) {}

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
  if (!this.userName || !this.email || !this.password) {
    this.error.set('Please fill in all fields.');
    return;
  }
  if (!this.isUsernameValid) {
    this.error.set('Please fix the username errors before submitting.');
    return;
  }
  if (this.password.length < 6) {
    this.error.set('Password must be at least 6 characters.');
    return;
  }

  this.loading.set(true);
  this.error.set('');

  this.authService.register({
    userName: this.userName,
    email: this.email,
    password: this.password
  }).subscribe({
    next: () => this.router.navigate(['/chat']),
    error: (err) => {
      console.log('Registration error full object:', err);
      console.log('err.error:', err.error);
      console.log('err.status:', err.status);

      let message = 'Registration failed. Please try again.';

      if (err.error) {
        if (typeof err.error === 'string') {
          message = err.error;
        } else if (err.error.message) {
          message = err.error.message;
        } else if (err.error.errors) {
          const errors = err.error.errors;
          message = Object.values(errors).flat().join(' ') as string;
        }
      }

      this.error.set(message);
      this.loading.set(false);
    }
  });
}
}