import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type IconName =
  | 'settings' | 'edit-profile' | 'add-member' | 'create-group'
  | 'logout' | 'sun' | 'moon' | 'eye' | 'eye-off' | 'search' | 'close' | 'send'
  | 'new-chat';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="app-icon"
    >
      @switch (name) {
        @case ('settings') {
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        }
        @case ('edit-profile') {
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9"></path>
          <path d="M14 3l6 6"></path>
          <path d="M14 3v5a1 1 0 0 0 1 1h5"></path>
          <circle cx="9.5" cy="12.5" r="1.75"></circle>
          <path d="M6.7 17c.5-1.4 1.6-2.2 2.8-2.2s2.3.8 2.8 2.2"></path>
          <path d="M17 15l3.5 3.5"></path>
          <path d="M19.5 13.5a1.5 1.5 0 1 1 2.12 2.12L18.5 19l-2-.5.5-2z"></path>
        }
        @case ('add-member') {
          <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path>
          <path d="M2.5 20a6.5 6.5 0 0 1 11.6-3.9"></path>
          <circle cx="18" cy="17" r="4"></circle>
          <path d="M18 15.5v3"></path>
          <path d="M16.5 17h3"></path>
        }
        @case ('create-group') {
          <path d="M17 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1"></path>
          <circle cx="9" cy="7" r="3.25"></circle>
          <path d="M20 20v-1a3.5 3.5 0 0 0-2.5-3.36"></path>
          <path d="M14.75 3.9a3.25 3.25 0 0 1 0 6.2"></path>
        }
        @case ('logout') {
          <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"></path>
          <path d="M15 17l5-5-5-5"></path>
          <path d="M20 12H9"></path>
        }
        @case ('sun') {
          <circle cx="12" cy="12" r="4.5"></circle>
          <path d="M12 2.5v2"></path>
          <path d="M12 19.5v2"></path>
          <path d="M4.6 4.6l1.4 1.4"></path>
          <path d="M18 18l1.4 1.4"></path>
          <path d="M2.5 12h2"></path>
          <path d="M19.5 12h2"></path>
          <path d="M4.6 19.4l1.4-1.4"></path>
          <path d="M18 6l1.4-1.4"></path>
        }
        @case ('moon') {
          <path d="M20.5 14.4A8.5 8.5 0 1 1 9.6 3.5a7 7 0 0 0 10.9 10.9z"></path>
        }
        @case ('eye') {
          <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        }
        @case ('eye-off') {
          <path d="M3 3l18 18"></path>
          <path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c7 0 10.5 7 10.5 7a13.5 13.5 0 0 1-3.1 4.1"></path>
          <path d="M6.3 6.6C3.4 8.4 1.5 12 1.5 12s3.5 7 10.5 7a10.6 10.6 0 0 0 4.2-.85"></path>
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>
        }
        @case ('search') {
          <circle cx="11" cy="11" r="7"></circle>
          <path d="M21 21l-4.3-4.3"></path>
        }
        @case ('close') {
          <path d="M18 6L6 18"></path>
          <path d="M6 6l12 12"></path>
        }
        @case ('send') {
          <path d="M22 2L11 13"></path>
          <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
        }
          @case ('new-chat') {
           <path d="M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path>
           <path d="M2 20a6.5 6.5 0 0 1 11.4-4.3"></path>
           <path d="M15.5 13.5h5.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1-1.5 1.5H18l-2.5 2.3V20h-1a1.5 1.5 0 0 1-1.5-1.5V15a1.5 1.5 0 0 1 1.5-1.5z"></path>
        }
        }
      
    </svg>
  `,
  styles: [`
    .app-icon {
      display: block;
      color: var(--icon-color);
    }
    :host(.icon-inverted) .app-icon {
      color: var(--icon-color-inverted);
    }
  `]
})
export class IconComponent {
  @Input() name!: IconName;
  @Input() size: number = 20;
}