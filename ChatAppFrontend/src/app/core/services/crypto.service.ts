import { Injectable } from '@angular/core';
import { ChatRoom } from '../models/chat-room.model';
import { User } from '../models/user.model';

const DB_NAME = 'chatapp-e2e';
const STORE_NAME = 'keys';
const PRIVATE_KEY_ID = 'my-private-key';
const ENCRYPTED_PREFIX = 'e2e1:';
const GROUP_ENCRYPTED_PREFIX = 'e2eg1:';

@Injectable({ providedIn: 'root' })
export class CryptoService {
  private db: IDBDatabase | null = null;
  private myKeyPair: CryptoKeyPair | null = null;

  // DM cache - unchanged
  private roomKeyCache = new Map<number, CryptoKey>();

  // Group cache
  private groupKeyCache = new Map<string, CryptoKey>();
  private groupLatestVersionCache = new Map<number, number>();

  private openDb(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
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
      const request = tx.objectStore(STORE_NAME).get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
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
      console.warn(
        'Web Crypto unavailable. Encryption requires HTTPS or localhost.'
      );

      return null;
    }

    const stored = await this.idbGet(PRIVATE_KEY_ID).catch(() => null);

    if (stored) {
      this.myKeyPair = {
        privateKey: await crypto.subtle.importKey(
          'jwk',
          stored.privateJwk,
          {
            name: 'ECDH',
            namedCurve: 'P-256'
          },
          true,
          ['deriveBits']
        ),

        publicKey: await crypto.subtle.importKey(
          'jwk',
          stored.publicJwk,
          {
            name: 'ECDH',
            namedCurve: 'P-256'
          },
          true,
          []
        )
      };

      return JSON.stringify(stored.publicJwk);
    }

    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveBits']
    ) as CryptoKeyPair;

    const privateJwk = await crypto.subtle.exportKey(
      'jwk',
      keyPair.privateKey
    );

    const publicJwk = await crypto.subtle.exportKey(
      'jwk',
      keyPair.publicKey
    );

    await this.idbSet(PRIVATE_KEY_ID, {
      privateJwk,
      publicJwk
    });

    this.myKeyPair = keyPair;

    return JSON.stringify(publicJwk);
  }

  async getMyPublicKeyJwk(): Promise<string | null> {
    if (!this.myKeyPair) return null;

    const jwk = await crypto.subtle.exportKey(
      'jwk',
      this.myKeyPair.publicKey
    );

    return JSON.stringify(jwk);
  }

  hasKeyPair(): boolean {
    return !!this.myKeyPair;
  }

  
  // DIRECT MESSAGE ENCRYPTION - UNCHANGED
  

  async getRoomKey(
    room: ChatRoom,
    currentUser: User
  ): Promise<CryptoKey | null> {
    if (room.isGroup) return null;
    if (!this.myKeyPair) return null;

    const cached = this.roomKeyCache.get(room.id);

    if (cached) return cached;

    const other = room.members.find(
      member => member.id !== currentUser.id
    );

    if (!other?.publicKey) return null;

    try {
      const theirPublicKey = await crypto.subtle.importKey(
        'jwk',
        JSON.parse(other.publicKey),
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        []
      );

      const sharedBits = await crypto.subtle.deriveBits(
        {
          name: 'ECDH',
          public: theirPublicKey
        } as EcdhKeyDeriveParams,
        this.myKeyPair.privateKey,
        256
      );

      const hkdfKey = await crypto.subtle.importKey(
        'raw',
        sharedBits,
        'HKDF',
        false,
        ['deriveKey']
      );

      const aesKey = await crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: new Uint8Array(0),
          info: new TextEncoder().encode('chatapp-dm-v1')
        } as HkdfParams,
        hkdfKey,
        {
          name: 'AES-GCM',
          length: 256
        },
        false,
        ['encrypt', 'decrypt']
      );

      this.roomKeyCache.set(room.id, aesKey);

      return aesKey;
    } catch (err) {
      console.error('Failed to derive room key:', err);
      return null;
    }
  }

  async encryptForRoom(
    room: ChatRoom,
    currentUser: User,
    plaintext: string
  ): Promise<string> {
    if (!plaintext) return plaintext;

    const key = await this.getRoomKey(room, currentUser);

    if (!key) return plaintext;

    const iv = crypto.getRandomValues(
      new Uint8Array(12)
    );

    const encoded = new TextEncoder().encode(
      plaintext
    );

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      encoded
    );

    const combined = new Uint8Array(
      iv.length + ciphertext.byteLength
    );

    combined.set(iv, 0);

    combined.set(
      new Uint8Array(ciphertext),
      iv.length
    );

    return ENCRYPTED_PREFIX + this.toBase64(combined);
  }

  async decryptForRoom(
    room: ChatRoom,
    currentUser: User,
    content: string
  ): Promise<string> {
    if (
      !content ||
      !content.startsWith(ENCRYPTED_PREFIX)
    ) {
      return content;
    }

    const key = await this.getRoomKey(
      room,
      currentUser
    );

    if (!key) {
      return '🔒 Encrypted message';
    }

    try {
      const combined = this.fromBase64(
        content.slice(ENCRYPTED_PREFIX.length)
      );

      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv
        },
        key,
        ciphertext
      );

      return new TextDecoder().decode(
        decrypted
      );
    } catch (err) {
      console.error(
        'Failed to decrypt message:',
        err
      );

      return '🔒 Could not decrypt this message';
    }
  }

  isEncryptedPayload(
    content: string | undefined | null
  ): boolean {
    return !!content &&
      content.startsWith(ENCRYPTED_PREFIX);
  }

  // GROUP KEY WRAPPING
  

  private async unwrapGroupKey(
    encryptedKey: string,
    distributorPublicKeyJwk: string
  ): Promise<CryptoKey> {
    if (!this.myKeyPair) {
      throw new Error(
        'Local encryption key pair is unavailable.'
      );
    }

    const theirPublicKey = await crypto.subtle.importKey(
      'jwk',
      JSON.parse(distributorPublicKeyJwk),
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      []
    );

    const sharedBits = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: theirPublicKey
      } as EcdhKeyDeriveParams,
      this.myKeyPair.privateKey,
      256
    );

    const hkdfKey = await crypto.subtle.importKey(
      'raw',
      sharedBits,
      'HKDF',
      false,
      ['deriveKey']
    );

    const wrappingKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(0),
        info: new TextEncoder().encode(
          'chatapp-group-wrap-v1'
        )
      } as HkdfParams,
      hkdfKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['decrypt']
    );

    const combined = this.fromBase64(
      encryptedKey
    );

    if (combined.length <= 12) {
      throw new Error(
        'Invalid encrypted group key payload.'
      );
    }

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const rawKeyBytes = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      wrappingKey,
      ciphertext
    );

    return crypto.subtle.importKey(
      'raw',
      rawKeyBytes,
      {
        name: 'AES-GCM'
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async wrapGroupKeyForMember(
    rawGroupKey: ArrayBuffer,
    memberPublicKeyJwk: string
  ): Promise<string> {
    if (!this.myKeyPair) {
      throw new Error(
        'Local encryption key pair is unavailable.'
      );
    }

    const theirPublicKey = await crypto.subtle.importKey(
      'jwk',
      JSON.parse(memberPublicKeyJwk),
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      []
    );

    const sharedBits = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: theirPublicKey
      } as EcdhKeyDeriveParams,
      this.myKeyPair.privateKey,
      256
    );

    const hkdfKey = await crypto.subtle.importKey(
      'raw',
      sharedBits,
      'HKDF',
      false,
      ['deriveKey']
    );

    const wrappingKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(0),
        info: new TextEncoder().encode(
          'chatapp-group-wrap-v1'
        )
      } as HkdfParams,
      hkdfKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(
      new Uint8Array(12)
    );

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      wrappingKey,
      rawGroupKey
    );

    const combined = new Uint8Array(
      iv.length + ciphertext.byteLength
    );

    combined.set(iv, 0);

    combined.set(
      new Uint8Array(ciphertext),
      iv.length
    );

    return this.toBase64(combined);
  }

  // GROUP KEY CACHE
  

  private getGroupCacheKey(
    roomId: number,
    version: number
  ): string {
    return `${roomId}:${version}`;
  }

  async loadGroupKeys(
    roomId: number,
    fetchKeysFn: () => Promise<{
      keyVersion: number;
      encryptedKey: string;
      distributorPublicKey: string;
    }[]>
  ): Promise<boolean> {
    if (!this.myKeyPair) {
      console.error(
        `Cannot load group keys for room ${roomId}: local key pair unavailable.`
      );

      return false;
    }

    const entries = await fetchKeysFn();

    if (!entries?.length) {
      console.warn(
        `No group key entries received for room ${roomId}.`
      );

      return false;
    }

    let highestUsableVersion = 0;

    const sortedEntries = [...entries].sort(
      (a, b) => b.keyVersion - a.keyVersion
    );

    for (const entry of sortedEntries) {
      if (
        !entry.encryptedKey ||
        !entry.distributorPublicKey ||
        !entry.keyVersion
      ) {
        continue;
      }

      const cacheKey = this.getGroupCacheKey(
        roomId,
        entry.keyVersion
      );

      try {
        if (!this.groupKeyCache.has(cacheKey)) {
          const aesKey = await this.unwrapGroupKey(
            entry.encryptedKey,
            entry.distributorPublicKey
          );

          this.groupKeyCache.set(
            cacheKey,
            aesKey
          );
        }

        if (
          this.groupKeyCache.has(cacheKey) &&
          entry.keyVersion > highestUsableVersion
        ) {
          highestUsableVersion =
            entry.keyVersion;
        }
      } catch (err) {
        console.error(
          `Failed to unwrap group key v${entry.keyVersion} for room ${roomId}:`,
          err
        );
      }
    }

    if (highestUsableVersion === 0) {
      console.error(
        `No usable group key found for room ${roomId}.`
      );

      return false;
    }

    const currentVersion =
      this.groupLatestVersionCache.get(roomId) || 0;

    if (
      highestUsableVersion >= currentVersion
    ) {
      this.groupLatestVersionCache.set(
        roomId,
        highestUsableVersion
      );
    }

    return true;
  }

  hasGroupKey(roomId: number): boolean {
    const version =
      this.groupLatestVersionCache.get(roomId);

    if (!version) {
      return false;
    }

    return this.groupKeyCache.has(
      this.getGroupCacheKey(
        roomId,
        version
      )
    );
  }

  getLatestGroupKeyVersion(
    roomId: number
  ): number | null {
    return this.groupLatestVersionCache.get(roomId)
      ?? null;
  }


  // GROUP MESSAGE ENCRYPTION
  

  async encryptForGroup(
    roomId: number,
    plaintext: string
  ): Promise<string> {
    if (!plaintext) {
      return plaintext;
    }

    const version =
      this.groupLatestVersionCache.get(roomId);

    if (!version) {
      throw new Error(
        `Cannot encrypt group message. No group key is available for room ${roomId}.`
      );
    }

    const key = this.groupKeyCache.get(
      this.getGroupCacheKey(
        roomId,
        version
      )
    );

    if (!key) {
      throw new Error(
        `Cannot encrypt group message. Group key v${version} is unavailable for room ${roomId}.`
      );
    }

    const iv = crypto.getRandomValues(
      new Uint8Array(12)
    );

    const encoded = new TextEncoder().encode(
      plaintext
    );

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      encoded
    );

    const combined = new Uint8Array(
      iv.length + ciphertext.byteLength
    );

    combined.set(iv, 0);

    combined.set(
      new Uint8Array(ciphertext),
      iv.length
    );

    return `${GROUP_ENCRYPTED_PREFIX}${version}:${this.toBase64(combined)}`;
  }

  async decryptForGroup(
    roomId: number,
    content: string
  ): Promise<string> {
    if (
      !content ||
      !content.startsWith(GROUP_ENCRYPTED_PREFIX)
    ) {
      return content;
    }

    const prefixLength =
      GROUP_ENCRYPTED_PREFIX.length;

    const separatorIndex =
      content.indexOf(':', prefixLength);

    if (separatorIndex === -1) {
      return '🔒 Could not decrypt this message';
    }

    const versionText = content.substring(
      prefixLength,
      separatorIndex
    );

    const version = Number.parseInt(
      versionText,
      10
    );

    if (
      !Number.isInteger(version) ||
      version <= 0
    ) {
      return '🔒 Could not decrypt this message';
    }

    const payload = content.substring(
      separatorIndex + 1
    );

    const key = this.groupKeyCache.get(
      this.getGroupCacheKey(
        roomId,
        version
      )
    );

    if (!key) {
      return '🔒 Encrypted message (key unavailable)';
    }

    try {
      const combined =
        this.fromBase64(payload);

      if (combined.length <= 12) {
        throw new Error(
          'Invalid encrypted message payload.'
        );
      }

      const iv = combined.slice(0, 12);

      const ciphertext =
        combined.slice(12);

      const decrypted =
        await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv
          },
          key,
          ciphertext
        );

      return new TextDecoder().decode(
        decrypted
      );
    } catch (err) {
      console.error(
        'Failed to decrypt group message:',
        err
      );

      return '🔒 Could not decrypt this message';
    }
  }

  isGroupEncryptedPayload(
    content: string | undefined | null
  ): boolean {
    return !!content &&
      content.startsWith(
        GROUP_ENCRYPTED_PREFIX
      );
  }

  // GROUP KEY CREATION AND DISTRIBUTION
  async createAndWrapGroupKey(
  members: {
    id: string;
    publicKey?: string;
  }[]
): Promise<{
  myPublicKeyJwk: string;
  entries: {
    userId: string;
    encryptedKey: string;
  }[];
} | null> {
  if (!this.myKeyPair) {
    console.error('Cannot create group key: local key pair unavailable.');
    return null;
  }

  if (!members || members.length === 0) {
    console.error('Cannot create group key: group has no members.');
    return null;
  }

  const membersWithoutPublicKeys = members.filter(
    member => !member.publicKey
  );

  if (membersWithoutPublicKeys.length > 0) {
    console.error(
      'Cannot create group key because some members have no public key:',
      membersWithoutPublicKeys.map(member => member.id)
    );

    return null;
  }

  const rawKey = crypto.getRandomValues(
    new Uint8Array(32)
  ).buffer;

  const myPublicJwk = await crypto.subtle.exportKey(
    'jwk',
    this.myKeyPair.publicKey
  );

  const myPublicKeyJwk = JSON.stringify(myPublicJwk);

  const entries: {
    userId: string;
    encryptedKey: string;
  }[] = [];

  for (const member of members) {
    try {
      const encryptedKey =
        await this.wrapGroupKeyForMember(
          rawKey,
          member.publicKey!
        );

      entries.push({
        userId: member.id,
        encryptedKey
      });
    } catch (err) {
      console.error(
        `Failed to wrap group key for member ${member.id}:`,
        err
      );

      return null;
    }
  }

  if (entries.length !== members.length) {
    console.error(
      `Group key distribution incomplete. Expected ${members.length} entries but created ${entries.length}.`
    );

    return null;
  }

  return {
    myPublicKeyJwk,
    entries
  };
}

 
  async wrapExistingGroupKeyForNewMember(
    roomId: number,
    newMember: {
      id: string;
      publicKey?: string;
    }
  ): Promise<{
    userId: string;
    encryptedKey: string;
  } | null> {
    if (!newMember.publicKey) {
      return null;
    }

    const version =
      this.groupLatestVersionCache.get(roomId);

    if (!version) {
      return null;
    }

    const aesKey = this.groupKeyCache.get(
      this.getGroupCacheKey(
        roomId,
        version
      )
    );

    if (!aesKey) {
      return null;
    }

    try {
      const rawKeyBytes =
        await crypto.subtle.exportKey(
          'raw',
          aesKey
        );

      const encryptedKey =
        await this.wrapGroupKeyForMember(
          rawKeyBytes,
          newMember.publicKey
        );

      return {
        userId: newMember.id,
        encryptedKey
      };
    } catch (err) {
      console.error(
        'Failed to wrap existing group key for new member:',
        err
      );

      return null;
    }
  }

  clearGroupKeyCache(
    roomId: number
  ): void {
    this.groupLatestVersionCache.delete(
      roomId
    );

    const prefix = `${roomId}:`;

    for (
      const cacheKey of Array.from(
        this.groupKeyCache.keys()
      )
    ) {
      if (cacheKey.startsWith(prefix)) {
        this.groupKeyCache.delete(
          cacheKey
        );
      }
    }
  }

  
  private toBase64(
    bytes: Uint8Array
  ): string {
    let binary = '';

    bytes.forEach(
      byte => binary += String.fromCharCode(byte)
    );

    return btoa(binary);
  }

  private fromBase64(
    base64: string
  ): Uint8Array {
    const binary = atob(base64);

    const bytes = new Uint8Array(
      binary.length
    );

    for (
      let i = 0;
      i < binary.length;
      i++
    ) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }
}