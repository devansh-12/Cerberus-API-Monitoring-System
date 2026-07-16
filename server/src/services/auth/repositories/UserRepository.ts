import BaseRepository from './BaseRepository.js';
import User, { IUser } from '../../../shared/models/User.js';
import logger from '../../../shared/config/logger.js';

/**
 * MongoDB implementation of the UserRepository.
 */
class MongoUserRepository extends BaseRepository<IUser> {
  constructor() {
    super(User);
  }

  /**
   * Creates a new user in the database.
   */
  async create(userData: Partial<IUser>): Promise<IUser> {
    try {
      const data: Partial<IUser> = { ...userData };
      
      if (data.role === 'super_admin' && !data.permissions) {
        data.permissions = {
          canCreateApiKeys: true,
          canManageUsers: true,
          canViewAnalytics: true,
          canExportData: true,
        };
      }

      const user = new this.model(data);
      await user.save();

      logger.info('User created', { username: user.username });
      return user;
    } catch (error) {
      logger.error('Error creating user', error);
      throw error;
    }
  }

  /**
   * Finds a user by their ID.
   */
  async findById(userId: string): Promise<IUser | null> {
    try {
      const user = await this.model.findById(userId);
      return user;
    } catch (error) {
      logger.error('Error finding user by id', error);
      throw error;
    }
  }

  /**
   * Finds a user by their username.
   */
  async findByUsername(username: string): Promise<IUser | null> {
    try {
      const user = await this.model.findOne({ username });
      return user;
    } catch (error) {
      logger.error('Error finding user by username', error);
      throw error;
    }
  }

  /**
   * Finds a user by their email.
   */
  async findByEmail(email: string): Promise<IUser | null> {
    try {
      const user = await this.model.findOne({ email });
      return user;
    } catch (error) {
      logger.error('Error finding user by email', error);
      throw error;
    }
  }

  /**
   * Finds all active users.
   */
  async findAll(): Promise<IUser[]> {
    try {
      const users = await this.model.find({ isActive: true }).select('-password');
      return users;
    } catch (error) {
      logger.error('Error finding active users', error);
      throw error;
    }
  }

  /**
   * Saves (or clears) the hashed refresh token for a user.
   * Pass null to revoke — used during logout.
   */
  async updateRefreshToken(userId: string, hashedToken: string | null): Promise<void> {
    try {
      await this.model.findByIdAndUpdate(userId, { refreshToken: hashedToken });
    } catch (error) {
      logger.error('Error updating refresh token', error);
      throw error;
    }
  }

  /**
   * Looks up a user whose stored hashed refresh token matches the provided hash.
   */
  async findByRefreshToken(hashedToken: string): Promise<IUser | null> {
    try {
      const user = await this.model.findOne({ refreshToken: hashedToken });
      return user;
    } catch (error) {
      logger.error('Error finding user by refresh token', error);
      throw error;
    }
  }
}

export default new MongoUserRepository();
