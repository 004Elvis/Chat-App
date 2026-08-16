import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { AdminUser, AdminStats } from '../../../core/models/admin.model';
import { IconComponent } from '../../../core/components/icon/icon.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.css'
})
export class AdminPageComponent implements OnInit {
  users = signal<AdminUser[]>([]);
  stats = signal<AdminStats | null>(null);
  loading = signal(true);
  error = signal('');
  searchQuery = '';
  currentUserId = signal<string | null>(null);

  constructor(private adminService: AdminService, private authService: AuthService) {}

  ngOnInit(): void {
     this.currentUserId.set(this.authService.currentUser()?.id ?? null);
    this.adminService.getStats().subscribe({
      next: s => this.stats.set(s),
      error: () => {}
    });

    this.adminService.getAllUsers().subscribe({
      next: users => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load users. You may not have admin access.');
        this.loading.set(false);
      }
    });
  }

  get filteredUsers(): AdminUser[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.users();
    return this.users().filter(u =>
      u.userName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }

  getInitials(name: string): string {
    return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString([], {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  formatDateTime(dateStr?: string): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString([], {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  toggleAdmin(user: AdminUser): void {
  const action = user.isSiteAdmin ? 'revoke admin access from' : 'grant admin access to';
  if (!confirm(`Are you sure you want to ${action} ${user.userName}?`)) return;

  this.adminService.toggleSiteAdmin(user.id).subscribe({
    next: (res) => {
      this.users.update(list =>
        list.map(u => u.id === user.id ? { ...u, isSiteAdmin: res.isSiteAdmin } : u)
      );
    },
    error: (err) => {
      alert(err.error?.message || 'Could not update admin status.');
    }
  });
}
}