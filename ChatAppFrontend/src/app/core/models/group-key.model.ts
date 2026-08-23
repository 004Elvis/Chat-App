export interface GroupKeyResponse {
  keyVersion: number;
  encryptedKey: string;
  distributorPublicKey: string;
}

export interface GroupKeyVersionInfo {
  latestVersion: number;
  memberUserIdsWithKey: string[];
}