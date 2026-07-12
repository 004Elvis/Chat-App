import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  userName = '';
  email = '';
  password = '';
  error = signal('');
  loading = signal(false);
  usernameError = signal('');
  showPassword = signal(false);

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

  get passwordStrength(): {
    score: number;
    label: string;
    color: string;
    checks: { label: string; passed: boolean }[]
  } {
    const p = this.password;
    const checks = [
      { label: 'At least 8 characters', passed: p.length >= 8 },
      { label: 'Uppercase letter (A–Z)', passed: /[A-Z]/.test(p) },
      { label: 'Lowercase letter (a–z)', passed: /[a-z]/.test(p) },
      { label: 'Number (0–9)', passed: /[0-9]/.test(p) },
      { label: 'Special character (!@#$...)', passed: /[^a-zA-Z0-9]/.test(p) }
    ];

    const score = checks.filter(c => c.passed).length;
    let label = '';
    let color = '';

    if (p.length === 0) { label = ''; color = ''; }
    else if (score <= 1) { label = 'Very Weak'; color = '#ef4444'; }
    else if (score === 2) { label = 'Weak'; color = '#f97316'; }
    else if (score === 3) { label = 'Fair'; color = '#eab308'; }
    else if (score === 4) { label = 'Strong'; color = '#22c55e'; }
    else { label = 'Very Strong'; color = '#16a34a'; }

    return { score, label, color, checks };
  }

  get isPasswordStrong(): boolean {
    return this.passwordStrength.score >= 3;
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
    if (!this.isPasswordStrong) {
      this.error.set('Please choose a stronger password.');
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
}