import mongoose, { Document, Schema } from 'mongoose';

export type ApiKeyEnvironment = 'production' | 'staging' | 'development' | 'testing';

export interface IApiKeyPermissions {
  canIngest: boolean;
  canReadAnalytics: boolean;
  allowedServices: string[];
}

export interface IApiKey extends Document {
  keyId: string;
  keyValue: string;
  ClientId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  environment: ApiKeyEnvironment;
  isActive: boolean;
  permissions: IApiKeyPermissions;
  security: {
    allowedIPs: string[];
    allowedOrigins: string[];
    lastRotated: Date;
    rotationWarningDays: number;
  };
  expiresAt: Date;
  createdBy: mongoose.Types.ObjectId;
  isExpired(): boolean;
  createdAt: Date;
  updatedAt: Date;
}

const apiKeySchema = new Schema<IApiKey>(
  {
    keyId: { type: String, required: true, unique: true, index: true },
    keyValue: { type: String, required: true, unique: true, index: true },
    ClientId: { type: Schema.Types.ObjectId, ref: 'Clients', required: true, index: true },
    name: { type: String, required: true, trim: true, maxLength: 100 },
    description: { type: String, maxlength: 500, default: '' },
    environment: { type: String, enum: ['production', 'staging', 'development', 'testing'], default: 'production' },
    isActive: { type: Boolean, default: true },
    permissions: {
      canIngest: { type: Boolean, default: true },
      canReadAnalytics: { type: Boolean, default: false },
      allowedServices: [{ type: String, trim: true }],
    },
    security: {
      allowedIPs: [{
        type: String,
        validate: {
          validator: (v: string) => /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(v) || v === '0.0.0.0/0',
          message: 'Invalid IP address format',
        },
      }],
      allowedOrigins: [{
        type: String,
        validate: {
          validator: (v: string) => /^https?:\/\/[^\s]+$/.test(v) || v === '*',
          message: 'Invalid origin format',
        },
      }],
      lastRotated: { type: Date, default: Date.now },
      rotationWarningDays: { type: Number, default: 30 },
    },
    expiresAt: {
      type: Date,
      index: true,
      default: () => {
        const days = parseInt(process.env['API_KEY_EXPIRY_DAYS'] ?? '365', 10);
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'api_keys' },
);

apiKeySchema.index({ clientId: 1, isActive: 1 });
apiKeySchema.index({ keyValue: 1, isActive: 1 });
apiKeySchema.index({ environment: 1, clientId: 1 });
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

apiKeySchema.methods.isExpired = function (this: IApiKey): boolean {
  if (!this.expiresAt) return false;
  return new Date(this.expiresAt) < new Date();
};

const ApiKey = mongoose.model<IApiKey>('ApiKey', apiKeySchema);
export default ApiKey;
