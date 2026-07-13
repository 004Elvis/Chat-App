import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent {
  email = '';
  message = signal('');
  error = signal('');
  loading = signal(false);
  sent = signal(false);

  constructor(private http: HttpClient) {}

  onSubmit(): void {
    if (!this.email) {
      this.error.set('Please enter your email address.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.http.post('http://localhost:5082/api/auth/forgot-password',
      { email: this.email })
      .subscribe({
        next: () => {
          this.sent.set(true);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Something went wrong. Please try again.');
          this.loading.set(false);
        }
      });
  }
}