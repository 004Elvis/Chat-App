import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'chat_theme';

  isDarkMode = signal<boolean>(this.getInitialTheme());

  constructor() {
    this.applyTheme(this.isDarkMode());
  }

  private getInitialTheme(): boolean {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  toggle(): void {
    const next = !this.isDarkMode();
    this.isDarkMode.set(next);
    this.applyTheme(next);
    localStorage.setItem(this.STORAGE_KEY, next ? 'dark' : 'light');
  }

  private applyTheme(dark: boolean): void {
    document.documentElement.setAttribute(
      'data-theme', dark ? 'dark' : 'light'
    );
  }
}