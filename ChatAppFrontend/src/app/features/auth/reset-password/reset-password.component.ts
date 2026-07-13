import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './reset-password.component.html'
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  newPassword = '';
  showPassword = signal(false);
  error = signal('');
  success = signal(false);
  loading = signal(false);
  tokenValid = signal(true);

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParams['token'] || '';
    if (!this.token) {
      this.tokenValid.set(false);
      this.error.set('Invalid or missing reset token.');
    }
  }

  get passwordScore(): number {
    const p = this.newPassword;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[a-z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^a-zA-Z0-9]/.test(p)) score++;
    return score;
  }

  onSubmit(): void {
    if (!this.newPassword || this.passwordScore < 3) {
      this.error.set('Please choose a stronger password.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.http.post('http://localhost:5082/api/auth/reset-password', {
      token: this.token,
      newPassword: this.newPassword
    }).subscribe({
      next: () => {
        this.success.set(true);
        this.loading.set(false);
        setTimeout(() => this.router.navigate(['/login']), 3000);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Reset failed. Link may have expired.');
        this.loading.set(false);
      }
    });
  }
}