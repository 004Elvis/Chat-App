import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-set-password',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './set-password.component.html'
})
export class SetPasswordComponent implements OnInit {
  token = '';
  password = '';
  confirmPassword = '';
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  error = signal('');
  success = signal(false);
  loading = signal(false);
  tokenValid = signal(true);

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParams['token'] || '';
    if (!this.token) {
      this.tokenValid.set(false);
      this.error.set('This link is missing its token.');
    }
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

  get passwordsMatch(): boolean {
    return this.confirmPassword.length > 0 && this.confirmPassword === this.password;
  }

  get showMismatch(): boolean {
    return this.confirmPassword.length > 0 && this.confirmPassword !== this.password;
  }

  onSubmit(): void {
    if (!this.isPasswordStrong) {
      this.error.set('Please choose a stronger password.');
      return;
    }
    if (!this.passwordsMatch) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.authService.setPassword({
      token: this.token,
      newPassword: this.password,
      confirmPassword: this.confirmPassword
    }).subscribe({
      next: () => {
        this.success.set(true);
        this.loading.set(false);
        setTimeout(() => this.router.navigate(['/chat']), 1500);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'This link is invalid or has expired.');
        this.loading.set(false);
      }
    });
  }
}
