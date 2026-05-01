import mongoose, { Document, Schema } from 'mongoose';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export interface IApiHit extends Document {
  eventId: string;
  timestamp: Date;
  serviceName: string;
  endpoint: string;
  method: HttpMethod;
  statusCode: number;
  latencyMs: number;
  ClientId: mongoose.Types.ObjectId;
  ApiKeyId: mongoose.Types.ObjectId;
  ip: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const apiHitSchema = new Schema<IApiHit>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    timestamp: { type: Date, required: true },
    serviceName: { type: String, required: true, index: true },
    endpoint: { type: String, required: true, index: true },
    method: { type: String, required: true, enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'] },
    statusCode: { type: Number, required: true, index: true },
    latencyMs: { type: Number, required: true },
    ClientId: { type: Schema.Types.ObjectId, ref: 'Clients', required: true, index: true },
    ApiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true, index: true },
    ip: { type: String, required: true },
    userAgent: { type: String },
  },
  { timestamps: true, collection: 'api_hits' },
);

apiHitSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2_592_000 });
apiHitSchema.index({ ClientId: 1, serviceName: 1, endpoint: 1, timestamp: -1 });
apiHitSchema.index({ ApiKeyId: 1, timestamp: -1 });

const ApiHit = mongoose.model<IApiHit>('ApiHit', apiHitSchema);
export default ApiHit;
