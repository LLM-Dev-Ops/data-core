import type { DataAccessService, SchemaNormalizerService } from '../services';

export interface DataRequest { dataId: string; options?: { schema?: string }; }
export interface DataResponse { data: unknown; metadata?: Record<string, unknown>; error?: string; }

export class DataRequestHandler {
  constructor(
    private dataAccess: DataAccessService,
    private schemaNormalizer: SchemaNormalizerService
  ) {}

  async get(dataId: string, options: { schema?: string } = {}): Promise<Record<string, unknown>> {
    const data = await this.dataAccess.retrieveSecure(dataId);
    if (options.schema && data) {
      await this.schemaNormalizer.validateData(options.schema, data);
    }
    return { data, dataId };
  }

  async resolveSchema(dataType: string): Promise<Record<string, unknown>> {
    const schema = await this.schemaNormalizer.getSchema(dataType);
    return { schema, dataType };
  }

  async normalize(data: Record<string, unknown>, schemaId: string): Promise<Record<string, unknown>> {
    const valid = await this.schemaNormalizer.validateData(schemaId, data);
    return { data, schemaId, valid };
  }
}
