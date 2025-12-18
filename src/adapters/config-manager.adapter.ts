/** Adapter for LLM-Config-Manager - configuration and secrets */

export interface IConfigManagerAdapter {
  getConfig(key: string): Promise<string | null>;
  setConfig(key: string, value: string): Promise<void>;
  getSecret(key: string): Promise<string | null>;
  listConfigs(prefix?: string): Promise<Record<string, string>>;
}

export class ConfigManagerAdapter implements IConfigManagerAdapter {
  async getConfig(key: string): Promise<string | null> {
    console.log(`[ConfigManager] Get config: ${key}`);
    return null;
  }

  async setConfig(key: string, value: string): Promise<void> {
    console.log(`[ConfigManager] Set config: ${key}`);
  }

  async getSecret(key: string): Promise<string | null> {
    console.log(`[ConfigManager] Get secret: ${key}`);
    return null;
  }

  async listConfigs(prefix?: string): Promise<Record<string, string>> {
    console.log(`[ConfigManager] List configs: ${prefix || 'all'}`);
    return {};
  }
}
