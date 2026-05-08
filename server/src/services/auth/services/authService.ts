import config from '../../../shared/config/index.js';
import AppError from '../../../shared/utils/AppError.js';
import jwt from 'jsonwebtoken';
import logger from '../../../shared/config/logger.js';
import bcrypt from 'bcryptjs';
import { IUser } from '../../../shared/models/User.js';
import MongoUserRepository from '../repositories/UserRepository.js';
import { APPLICATION_ROLES } from '../../../shared/constants/roles.js';

export interface TokenAndUser {
  user: Omit<IUser, 'password'>;
  token: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * AuthService handles user authentication and authorization.
 */
export class AuthService {
  private userRepository: typeof MongoUserRepository;

  constructor(userRepository: typeof MongoUserRepository) {
    if (!userRepository) {
      throw new Error('UserRepository is Required');
    }
    this.userRepository = userRepository;
  }

  /**
   * Generates a JWT token for the given user.
   */
  generateToken(user: IUser): string {
    const { _id, email, username, role, clientId } = user;

    const payload = {
      userId: _id,
      username,
      email,
      role,
      clientId,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  /**
   * Formats the user object for response by removing sensitive information.
   */
  formatUserForResponse(user: IUser): Omit<IUser, 'password'> {
    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;
    return userObj;
  }

  /**
   * Compares the user-entered password with the hashed password.
   */
  async comparePassword(userEnteredPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(userEnteredPassword, hashedPassword);
  }

  /**
   * Onboards a new super admin user.
   */
  async onboardSuperAdmin(superAdminData: Partial<IUser>): Promise<TokenAndUser> {
    try {
      const existingUser = await this.userRepository.findAll();

      if (existingUser && existingUser.length > 0) {
        throw new AppError('Super admin onboarding is disabled', 403);
      }

      const user = await this.userRepository.create(superAdminData);
      const token = this.generateToken(user);

      logger.info('Admin onboarded successfully', {
        username: user.username,
      });

      return {
        user: this.formatUserForResponse(user),
        token,
      };
    } catch (error) {
      logger.error('Error in onboarding Super admin', error);
      throw error;
    }
  }

  /**
   * Registers a new user.
   */
  async register(userData: Partial<IUser>): Promise<TokenAndUser> {
    try {
      const existingUser = await this.userRepository.findByUsername(userData.username!);
      if (existingUser) {
        throw new AppError('Username already exists', 409);
      }

      const existingEmail = await this.userRepository.findByEmail(userData.email!);
      if (existingEmail) {
        throw new AppError('Email already exists', 409);
      }

      const user = await this.userRepository.create(userData);
      const token = this.generateToken(user);

      logger.info('User registered successfully', {
        username: user.username,
      });

      return {
        user: this.formatUserForResponse(user),
        token,
      };
    } catch (error) {
      logger.error('Error in Register service', error);
      throw error;
    }
  }

  /**
   * Logs in a user.
   */
  async login(username: string, password: string): Promise<TokenAndUser> {
    try {
      const user = await this.userRepository.findByUsername(username);

      if (!user) {
        throw new AppError('Invalid Credentials', 401);
      }

      if (!user.isActive) {
        throw new AppError('Account is deactivated', 403);
      }

      const isPasswordValid = await this.comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw new AppError('Invalid Credentials', 401);
      }

      const token = this.generateToken(user);

      logger.info('User loggedIn successfully', { username: user.username });

      return {
        user: this.formatUserForResponse(user),
        token,
      };
    } catch (error) {
      logger.error('Error in Login service', error);
      throw error;
    }
  }

  /**
   * Fetches the profile of a user by their ID.
   */
  async getProfile(userId: string): Promise<Omit<IUser, 'password'>> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }
      return this.formatUserForResponse(user);
    } catch (error) {
      logger.error('Error getting user profile:', error);
      throw error;
    }
  }

  /**
   * Checks if user has super admin permissions.
   */
  async checkSuperAdminPermissions(userId: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      return user.role === APPLICATION_ROLES.SUPER_ADMIN;
    } catch (error) {
      logger.error('Error checking super admin permissions', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }
}
