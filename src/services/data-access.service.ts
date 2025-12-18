import type { IDataVaultAdapter, IStorageOptions } from '../adapters';

/**
 * Orchestrates secure data access via Data-Vault adapter.
 * Thin glue layer for authorization and encrypted data operations.
 */
export class DataAccessService {
  constructor(private readonly dataVaultAdapter: IDataVaultAdapter) {}

  async storeSecure(key: string, data: unknown, options?: IStorageOptions): Promise<void> {
    return this.dataVaultAdapter.store(key, data, options);
  }

  async retrieveSecure(key: string): Promise<unknown | null> {
    return this.dataVaultAdapter.retrieve(key);
  }

  async anonymizeData(data: unknown, sensitiveFields: string[]): Promise<unknown> {
    return this.dataVaultAdapter.anonymize(data, sensitiveFields);
  }

  async deleteSecure(key: string): Promise<void> {
    return this.dataVaultAdapter.delete(key);
  }

  async storeEncrypted(key: string, data: unknown, ttl?: number): Promise<void> {
    return this.dataVaultAdapter.store(key, data, { encrypted: true, ttl });
  }

  async storeCompressed(key: string, data: unknown): Promise<void> {
    return this.dataVaultAdapter.store(key, data, { compressed: true });
  }
}
