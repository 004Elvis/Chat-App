import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  userName = '';
  email = '';
  password = '';
  error = signal('');
  loading = signal(false);

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    if (!this.userName || !this.email || !this.password) {
      this.error.set('Please fill in all fields.');
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
      error: () => {
        this.error.set('Registration failed. Email or username may already exist.');
        this.loading.set(false);
      }
    });
  }
}