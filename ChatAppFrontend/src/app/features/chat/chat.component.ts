import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  template: `
    <div style="padding: 2rem; text-align: center;">
      <h2>Welcome, {{ authService.currentUser()?.userName }}!</h2>
      <p>Chat interface coming next.</p>
      <button class="btn btn-secondary" (click)="authService.logout()">
        Logout
      </button>
    </div>
  `
})
export class ChatComponent {
  constructor(public authService: AuthService) {}
}