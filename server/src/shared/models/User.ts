import mongoose, { Document, Schema } from 'mongoose';
import SecurityUtils from '../utils/SecurityUtils.js';
import { Role } from '../constants/roles.js';

export interface IUserPermissions {
  canCreateApiKeys: boolean;
  canManageUsers: boolean;
  canViewAnalytics: boolean;
  canExportData: boolean;
}

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: Role;
  clientId?: mongoose.Types.ObjectId;
  isActive: boolean;
  permissions: IUserPermissions;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String, required: true, unique: true, trim: true, minlength: 3,
      validate: {
        validator: (v: string) => /^[a-zA-Z0-9_.-]+$/.test(v),
        message: 'Please enter a valid username',
      },
    },
    email: {
      type: String, required: true, unique: true, lowercase: true, trim: true,
      validate: {
        validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Please enter a valid email',
      },
    },
    password: {
      type: String, required: true, minlength: 6,
      validate: {
        validator: function (this: IUser, password: string) {
          if (this.isModified('password') && password && !password.startsWith('$2a$')) {
            return SecurityUtils.validatePassword(password).success;
          }
          return true;
        },
        message: function (props: mongoose.ValidatorProps) {
          if (props.value && !String(props.value).startsWith('$2a$')) {
            return SecurityUtils.validatePassword(String(props.value)).errors.join('. ');
          }
          return 'Password validation failed';
        },
      },
    },
    role: { type: String, enum: ['super_admin', 'client_admin', 'client_viewer'], default: 'client_viewer' },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: false },
    isActive: { type: Boolean, default: true },
    permissions: {
      canCreateApiKeys: { type: Boolean, default: false },
      canManageUsers: { type: Boolean, default: false },
      canViewAnalytics: { type: Boolean, default: true },
      canExportData: { type: Boolean, default: false },
    },
  },
  { timestamps: true, collection: 'users' },
);

import bcrypt from 'bcryptjs';

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.index({ clientId: 1, isActive: 1 });
userSchema.index({ role: 1 });

const User = mongoose.model<IUser>('User', userSchema);
export default User;
