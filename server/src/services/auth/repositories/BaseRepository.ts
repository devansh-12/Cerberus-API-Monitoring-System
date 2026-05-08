import { Model, Document } from 'mongoose';

export default class BaseRepository<T extends Document> {
  protected model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  async create(data: Partial<T>): Promise<T> {
    throw new Error('Method not implemented');
  }

  async findById(id: string): Promise<T | null> {
    throw new Error('Method not implemented');
  }

  async findByUsername(username: string): Promise<T | null> {
    throw new Error('Method not implemented');
  }

  async findByEmail(email: string): Promise<T | null> {
    throw new Error('Method not implemented');
  }

  async findAll(): Promise<T[]> {
    throw new Error('Method not implemented');
  }
}
