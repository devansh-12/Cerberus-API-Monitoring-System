/**
 * BaseRepository - Database-agnostic repository contract.
 */
export class BaseRepository {
  protected logger: Console;

  constructor({ logger: l = console }: { logger?: Console } = {}) {
    this.logger = l;
  }

  async save(_data: any): Promise<any> {
    throw new Error('Method not implemented: save');
  }

  async find(_query: any): Promise<any> {
    throw new Error('Method not implemented: find');
  }

  async count(_query: any): Promise<number> {
    throw new Error('Method not implemented: count');
  }

  async deleteOldHits(_cutoffDate: Date): Promise<number> {
    throw new Error('Method not implemented: deleteOldHits');
  }
}
