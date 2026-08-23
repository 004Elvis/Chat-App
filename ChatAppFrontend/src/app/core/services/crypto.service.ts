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

  async getMyPublicKeyJwk(): Promise<string | null> {
  if (!this.myKeyPair) return null;
  const jwk = await crypto.subtle.exportKey('jwk', this.myKeyPair.publicKey);
  return JSON.stringify(jwk);
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

  private async unwrapGroupKey(encryptedKey: string, distributorPublicKeyJwk: string): Promise<CryptoKey> {
  const theirPublicKey = await crypto.subtle.importKey(
    'jwk', JSON.parse(distributorPublicKeyJwk),
    { name: 'ECDH', namedCurve: 'P-256' }, true, []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPublicKey } as EcdhKeyDeriveParams,
    this.myKeyPair!.privateKey, 256
  );

  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);

  const wrappingKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF', hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('chatapp-group-wrap-v1')
    } as HkdfParams,
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false, ['decrypt']
  );

  const combined = this.fromBase64(encryptedKey);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const rawKeyBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, ciphertext);

  return crypto.subtle.importKey('raw', rawKeyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

private async wrapGroupKeyForMember(rawGroupKey: ArrayBuffer, memberPublicKeyJwk: string): Promise<string> {
  const theirPublicKey = await crypto.subtle.importKey(
    'jwk', JSON.parse(memberPublicKeyJwk),
    { name: 'ECDH', namedCurve: 'P-256' }, true, []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPublicKey } as EcdhKeyDeriveParams,
    this.myKeyPair!.privateKey, 256
  );

  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);

  const wrappingKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF', hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('chatapp-group-wrap-v1')
    } as HkdfParams,
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, rawGroupKey);

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return this.toBase64(combined);
}

// Wraps the group's CURRENT key for one additional member, without
// generating a new key or affecting anyone else's access. Used when
// adding someone to an existing group - as opposed to
// createAndWrapGroupKey, which generates a brand-new key for rotation.
async wrapExistingGroupKeyForNewMember(
  roomId: number, newMember: { id: string; publicKey?: string }
): Promise<{ userId: string; encryptedKey: string } | null> {
  if (!newMember.publicKey) return null;

  const latest = this.groupLatestVersionCache.get(roomId);
  if (!latest) return null;

  const aesKey = this.groupKeyCache.get(`${roomId}:${latest}`);
  if (!aesKey) return null;

  try {
    const rawKeyBytes = await crypto.subtle.exportKey('raw', aesKey);
    const encryptedKey = await this.wrapGroupKeyForMember(rawKeyBytes, newMember.publicKey);
    return { userId: newMember.id, encryptedKey };
  } catch (err) {
    console.error('Failed to wrap existing group key for new member:', err);
    return null;
  }
}

private groupKeyCache = new Map<string, CryptoKey>(); // key: `${roomId}:${version}`
private groupLatestVersionCache = new Map<number, number>(); // roomId -> latest known version

// Fetches every wrapped key version this user has for a group, decrypts
// each one locally, and caches them. Called whenever a group room is
// opened, and again whenever a GroupKeyRotated event arrives live.
async loadGroupKeys(
  roomId: number,
  fetchKeysFn: () => Promise<{ keyVersion: number; encryptedKey: string; distributorPublicKey: string }[]>
): Promise<boolean> {
  if (!this.myKeyPair) return false;

  const keys = await fetchKeysFn();
  let latest = 0;

  for (const entry of keys) {
    const cacheKey = `${roomId}:${entry.keyVersion}`;
    if (!this.groupKeyCache.has(cacheKey)) {
      try {
        const aesKey = await this.unwrapGroupKey(entry.encryptedKey, entry.distributorPublicKey);
        this.groupKeyCache.set(cacheKey, aesKey);
      } catch (err) {
        console.error(`Failed to unwrap group key v${entry.keyVersion} for room ${roomId}:`, err);
      }
    }
    if (entry.keyVersion > latest) latest = entry.keyVersion;
  }

  if (latest > 0) {
    this.groupLatestVersionCache.set(roomId, latest);
    return true;
  }
  return false;
}

hasGroupKey(roomId: number): boolean {
  const latest = this.groupLatestVersionCache.get(roomId);
  return !!latest && this.groupKeyCache.has(`${roomId}:${latest}`);
}

// Encrypts with the CURRENT (latest) group key - new messages always
// use the newest version, never an older one.
async encryptForGroup(roomId: number, plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;

  const latest = this.groupLatestVersionCache.get(roomId);
  if (!latest) return plaintext;

  const key = this.groupKeyCache.get(`${roomId}:${latest}`);
  if (!key) return plaintext;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Version-tagged prefix so a message encrypted under an old key can
  // still be decrypted correctly even after later rotations.
  return `e2eg1:${latest}:${this.toBase64(combined)}`;
}

// Decrypts using whichever key version the message was actually
// encrypted with, read straight out of the payload's own prefix.
async decryptForGroup(roomId: number, content: string): Promise<string> {
  if (!content || !content.startsWith('e2eg1:')) return content;

  const parts = content.split(':');
  if (parts.length < 3) return '🔒 Could not decrypt this message';

  const version = parseInt(parts[1], 10);
  const payload = parts.slice(2).join(':');

  const key = this.groupKeyCache.get(`${roomId}:${version}`);
  if (!key) return '🔒 Encrypted message (key unavailable)';

  try {
    const combined = this.fromBase64(payload);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('Failed to decrypt group message:', err);
    return '🔒 Could not decrypt this message';
  }
}

isGroupEncryptedPayload(content: string | undefined | null): boolean {
  return !!content && content.startsWith('e2eg1:');
}

// Generates a brand-new group key and wraps a copy for every given
// member's public key. Returns everything the caller needs to POST to
// /groupkey/distribute - this is called by an admin's client whenever
// the group is created, or whenever membership changes (remove/leave).
async createAndWrapGroupKey(
  members: { id: string; publicKey?: string }[]
): Promise<{ myPublicKeyJwk: string; entries: { userId: string; encryptedKey: string }[] } | null> {
  if (!this.myKeyPair) return null;

  const rawKey = crypto.getRandomValues(new Uint8Array(32)).buffer;
  const myPublicJwk = await crypto.subtle.exportKey('jwk', this.myKeyPair.publicKey);
  const myPublicKeyJwk = JSON.stringify(myPublicJwk);

  const entries: { userId: string; encryptedKey: string }[] = [];

  for (const member of members) {
    if (!member.publicKey) continue; // skip members who have no key yet
    try {
      const encryptedKey = await this.wrapGroupKeyForMember(rawKey, member.publicKey);
      entries.push({ userId: member.id, encryptedKey });
    } catch (err) {
      console.error(`Failed to wrap group key for member ${member.id}:`, err);
    }
  }

  if (entries.length === 0) return null;

  return { myPublicKeyJwk, entries };
}

clearGroupKeyCache(roomId: number): void {
  this.groupLatestVersionCache.delete(roomId);
  for (const key of Array.from(this.groupKeyCache.keys())) {
    if (key.startsWith(`${roomId}:`)) this.groupKeyCache.delete(key);
  }
}
}