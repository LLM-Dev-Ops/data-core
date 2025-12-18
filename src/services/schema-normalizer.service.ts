import type { ISchemaRegistryAdapter, ISchemaDefinition } from '../adapters';

/**
 * Provides schema-normalized views via Schema-Registry adapter.
 * Thin glue layer for schema operations and data normalization.
 */
export class SchemaNormalizerService {
  constructor(private readonly schemaRegistryAdapter: ISchemaRegistryAdapter) {}

  async registerSchema(definition: ISchemaDefinition): Promise<string> {
    return this.schemaRegistryAdapter.registerSchema(definition);
  }

  async getSchema(id: string, version?: string): Promise<ISchemaDefinition | null> {
    return this.schemaRegistryAdapter.getSchema(id, version);
  }

  async validateData(schemaId: string, data: unknown): Promise<boolean> {
    return this.schemaRegistryAdapter.validateData(schemaId, data);
  }

  async evolveSchema(id: string, newSchema: Record<string, unknown>): Promise<string> {
    return this.schemaRegistryAdapter.evolveSchema(id, newSchema);
  }

  async getLatestSchema(id: string): Promise<ISchemaDefinition | null> {
    return this.schemaRegistryAdapter.getSchema(id);
  }

  async validateWithSchema(id: string, version: string, data: unknown): Promise<boolean> {
    const schemaId = `${id}:${version}`;
    return this.schemaRegistryAdapter.validateData(schemaId, data);
  }
}
