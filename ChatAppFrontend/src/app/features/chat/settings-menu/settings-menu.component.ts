import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../core/components/icon/icon.component';
import { ThemeService } from '../../../core/services/theme.service';
import { ProfileModalComponent } from '../profile-modal/profile-modal.component';

@Component({
  selector: 'app-settings-menu',
  standalone: true,
  imports: [CommonModule, IconComponent, ProfileModalComponent],
  templateUrl: './settings-menu.component.html',
  styleUrl: './settings-menu.component.css'
})
export class SettingsMenuComponent {
  showDropdown = signal(false);
  showProfileModal = signal(false);

  constructor(public themeService: ThemeService) {}

  toggleDropdown(): void {
    this.showDropdown.set(!this.showDropdown());
  }

  closeDropdown(): void {
    this.showDropdown.set(false);
  }

  openProfile(): void {
    this.showProfileModal.set(true);
    this.closeDropdown();
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }
}