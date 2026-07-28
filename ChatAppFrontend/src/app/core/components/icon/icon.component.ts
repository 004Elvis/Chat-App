import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type IconName =
  | 'settings' | 'edit-profile' | 'add-member' | 'create-group'
  | 'logout' | 'sun' | 'moon' | 'eye' | 'eye-off' | 'search' | 'close' | 'send'
  | 'new-chat' | 'trash' | 'emoji' | 'app-logo' | 'reply'
  | 'attach' | 'camera' | 'document' | 'image' | 'video' | 'link' | 'download';

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
        @case ('trash') {
          <path d="M4 7h16"></path>
          <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"></path>
          <path d="M6 7l1 13.5A1.5 1.5 0 0 0 8.5 22h7a1.5 1.5 0 0 0 1.5-1.5L18 7"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
        }
        @case ('emoji') {
          <circle cx="12" cy="12" r="9.5"></circle>
          <path d="M8.5 10.5h.01"></path>
          <path d="M15.5 10.5h.01"></path>
          <path d="M8 14.5c1 1.3 2.4 2 4 2s3-.7 4-2"></path>
        }
        @case ('app-logo') {
          <rect x="7" y="2.5" width="10" height="19" rx="2.2"></rect>
          <path d="M9.5 7h5"></path>
          <path d="M9.5 10h5"></path>
          <path d="M9.5 13h3"></path>
          <path d="M3 8a2.2 2.2 0 0 1 2.2-2.2h1.1v4.6H5.2A2.2 2.2 0 0 1 3 8.2z"></path>
          <path d="M18.7 13.5h1.1A2.2 2.2 0 0 1 22 15.7v.2a2.2 2.2 0 0 1-2.2 2.2h-1.1z"></path>
        }
        @case ('reply') {
          <path d="M9 14l-5-5 5-5"></path>
          <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v.5"></path>
        }
        @case ('attach') {
          <path d="M21.4 11.1l-9.2 9.2a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"></path>
        }
        @case ('camera') {
          <path d="M4 8a2 2 0 0 1 2-2h1.2l1-1.6A1.5 1.5 0 0 1 9.5 3.6h5a1.5 1.5 0 0 1 1.3.8l1 1.6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path>
          <circle cx="12" cy="13" r="3.5"></circle>
        }
        @case ('document') {
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <path d="M14 3v5h5"></path>
          <path d="M9 13h6"></path>
          <path d="M9 17h6"></path>
        }
        @case ('image') {
          <rect x="3" y="4" width="18" height="16" rx="2"></rect>
          <circle cx="8.5" cy="9.5" r="1.75"></circle>
          <path d="M21 15.5l-5.5-5.5-9 9"></path>
        }
        @case ('video') {
          <rect x="2.5" y="6" width="13" height="12" rx="2"></rect>
          <path d="M15.5 10.5l6-3.5v10l-6-3.5z"></path>
        }
        @case ('link') {
          <path d="M9.5 14.5l5-5"></path>
          <path d="M7.5 12l-1.8 1.8a3.5 3.5 0 0 0 5 5L12.5 17"></path>
          <path d="M16.5 12l1.8-1.8a3.5 3.5 0 0 0-5-5L11.5 7"></path>
        }
        @case ('download') {
          <path d="M12 3v12"></path>
          <path d="M7 10l5 5 5-5"></path>
          <path d="M4 20h16"></path>
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