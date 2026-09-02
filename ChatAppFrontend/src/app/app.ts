import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { CallOverlayComponent } from './features/chat/call-overlay/call-overlay.component';
import { GroupCallOverlayComponent } from './features/chat/group-call-overlay/group-call-overlay.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CallOverlayComponent, GroupCallOverlayComponent],
  templateUrl: './app.html'
})
export class App {
  constructor(private themeService: ThemeService) {}
}