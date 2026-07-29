import { Injectable, signal } from '@angular/core';

export interface BackgroundPreset {
  id: string;
  label: string;
  css: string;
}

@Injectable({ providedIn: 'root' })
export class ChatBackgroundService {
  private readonly STORAGE_KEY = 'chat_backgrounds';

  presets: BackgroundPreset[] = [
    { id: 'default', label: 'Default', css: '' },
    { id: 'teal', label: 'Teal', css: 'linear-gradient(160deg, #1f6f64 0%, #0f2f2a 100%)' },
    { id: 'sunset', label: 'Sunset', css: 'linear-gradient(160deg, #f97316 0%, #7c2d12 100%)' },
    { id: 'ocean', label: 'Ocean', css: 'linear-gradient(160deg, #0ea5e9 0%, #0c4a6e 100%)' },
    { id: 'plum', label: 'Plum', css: 'linear-gradient(160deg, #a855f7 0%, #4c1d95 100%)' },
    { id: 'slate', label: 'Slate', css: 'linear-gradient(160deg, #64748b 0%, #1e293b 100%)' },
    { id: 'forest', label: 'Forest', css: 'linear-gradient(160deg, #22c55e 0%, #14532d 100%)' }
  ];

  private store = signal<Record<string, string>>(this.load());

  private load(): Record<string, string> {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private save(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.store()));
  }

  getBackgroundFor(roomId: number): string | null {
    const value = this.store()[roomId];
    if (!value) return null;

    if (value.startsWith('preset:')) {
      const presetId = value.slice('preset:'.length);
      const preset = this.presets.find(p => p.id === presetId);
      return preset ? preset.css : null;
    }

    return `url('${value}')`;
  }

  isImageBackground(roomId: number): boolean {
    const value = this.store()[roomId];
    return !!value && !value.startsWith('preset:');
  }

  setPreset(roomId: number, presetId: string): void {
    if (presetId === 'default') {
      this.clear(roomId);
      return;
    }
    const updated = { ...this.store(), [roomId]: `preset:${presetId}` };
    this.store.set(updated);
    this.save();
  }

  setCustomImage(roomId: number, url: string): void {
    const updated = { ...this.store(), [roomId]: url };
    this.store.set(updated);
    this.save();
  }

  clear(roomId: number): void {
    const updated = { ...this.store() };
    delete updated[roomId];
    this.store.set(updated);
    this.save();
  }
}