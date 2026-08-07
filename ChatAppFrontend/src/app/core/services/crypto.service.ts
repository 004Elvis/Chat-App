import { Injectable } from '@angular/core';
import { ChatRoom } from '../models/chat-room.model';
import { User } from '../models/user.model';

const DB_NAME = 'chatapp-e2e';
const STORE_NAME = 'keys';
const PRIVATE_KEY_ID = 'my-private-key';
const ENCRYPTED_PREFIX = 'e2e1:';

@Injectable({ providedIn: 'root' })
export class CryptoService {
  private db: IDBDatabase | null = null;
  private myKeyPair: CryptoKeyPair | null = null;
  private roomKeyCache = new Map<number, CryptoKey>();

  private openDb(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async idbGet(key: string): Promise<any> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async idbSet(key: string, value: any): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async ensureKeyPair(): Promise<string | null> {
    if (!window.isSecureContext || !crypto.subtle) {
      console.warn('Web Crypto unavailable (requires HTTPS or localhost). Encryption disabled.');
      return null;
    }

    const stored = await this.idbGet(PRIVATE_KEY_ID).catch(() => null);

    if (stored) {
      this.myKeyPair = {
        privateKey: await crypto.subtle.importKey(
          'jwk', stored.privateJwk,
          { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
        ),
        publicKey: await crypto.subtle.importKey(
          'jwk', stored.publicJwk,
          { name: 'ECDH', namedCurve: 'P-256' }, true, []
        )
      };
      return JSON.stringify(stored.publicJwk);
    }

    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
    ) as CryptoKeyPair;

    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    await this.idbSet(PRIVATE_KEY_ID, { privateJwk, publicJwk });
    this.myKeyPair = keyPair;

    return JSON.stringify(publicJwk);
  }

  hasKeyPair(): boolean {
    return !!this.myKeyPair;
  }

  async getRoomKey(room: ChatRoom, currentUser: User): Promise<CryptoKey | null> {
    if (room.isGroup) return null;
    if (!this.myKeyPair) return null;

    const cached = this.roomKeyCache.get(room.id);
    if (cached) return cached;

    const other = room.members.find(m => m.id !== currentUser.id);
    if (!other?.publicKey) return null;

    try {
      const theirPublicKey = await crypto.subtle.importKey(
        'jwk', JSON.parse(other.publicKey),
        { name: 'ECDH', namedCurve: 'P-256' }, true, []
      );

      const sharedBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: theirPublicKey } as EcdhKeyDeriveParams,
        this.myKeyPair.privateKey, 256
      );

      const hkdfKey = await crypto.subtle.importKey(
        'raw', sharedBits, 'HKDF', false, ['deriveKey']
      );

      const aesKey = await crypto.subtle.deriveKey(
        {
          name: 'HKDF', hash: 'SHA-256',
          salt: new Uint8Array(0),
          info: new TextEncoder().encode('chatapp-dm-v1')
        } as HkdfParams,
        hkdfKey,
        { name: 'AES-GCM', length: 256 },
        false, ['encrypt', 'decrypt']
      );

      this.roomKeyCache.set(room.id, aesKey);
      return aesKey;
    } catch (err) {
      console.error('Failed to derive room key:', err);
      return null;
    }
  }

  async encryptForRoom(room: ChatRoom, currentUser: User, plaintext: string): Promise<string> {
    if (!plaintext) return plaintext;

    const key = await this.getRoomKey(room, currentUser);
    if (!key) return plaintext;

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, encoded
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return ENCRYPTED_PREFIX + this.toBase64(combined);
  }

  async decryptForRoom(room: ChatRoom, currentUser: User, content: string): Promise<string> {
    if (!content || !content.startsWith(ENCRYPTED_PREFIX)) return content;

    const key = await this.getRoomKey(room, currentUser);
    if (!key) return '🔒 Encrypted message';

    try {
      const combined = this.fromBase64(content.slice(ENCRYPTED_PREFIX.length));
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv }, key, ciphertext
      );

      return new TextDecoder().decode(decrypted);
    } catch (err) {
      console.error('Failed to decrypt message:', err);
      return '🔒 Could not decrypt this message';
    }
  }

  isEncryptedPayload(content: string | undefined | null): boolean {
    return !!content && content.startsWith(ENCRYPTED_PREFIX);
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  }

  private fromBase64(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
}