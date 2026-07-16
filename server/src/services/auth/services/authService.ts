import config from '../../../shared/config/index.js';
import AppError from '../../../shared/utils/AppError.js';
import jwt from 'jsonwebtoken';
import logger from '../../../shared/config/logger.js';
import bcrypt from 'bcryptjs';
import { IUser } from '../../../shared/models/User.js';
import MongoUserRepository from '../repositories/UserRepository.js';
import { APPLICATION_ROLES } from '../../../shared/constants/roles.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: Omit<IUser, 'password'>;
  accessToken: string;
  refreshToken: string;
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

  // ── Token Helpers ──────────────────────────────────────────────────────────

  /**
   * Generates a short-lived JWT access token (default 15 m).
   */
  generateAccessToken(user: IUser): string {
    const { _id, email, username, role, clientId } = user;
    return jwt.sign(
      { userId: _id, username, email, role, clientId },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions,
    );
  }

  /**
   * Generates a long-lived, opaque refresh token (default 7 d).
   * The value is a signed JWT but treated as opaque by the client.
   */
  generateRefreshToken(user: IUser): string {
    const { _id } = user;
    return jwt.sign(
      { userId: _id },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn } as jwt.SignOptions,
    );
  }

  /**
   * bcrypt-hashes a raw refresh token for safe storage in MongoDB.
   */
  private async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  /**
   * Formats the user object for response by removing sensitive fields.
   */
  formatUserForResponse(user: IUser): Omit<IUser, 'password'> {
    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;
    delete userObj.refreshToken; // never expose the stored hash
    return userObj;
  }

  /**
   * Compares the user-entered password with the bcrypt hash.
   */
  async comparePassword(userEnteredPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(userEnteredPassword, hashedPassword);
  }

  // ── Auth Operations ────────────────────────────────────────────────────────

  /**
   * Issues a fresh token pair and persists the hashed refresh token.
   */
  private async issueTokenPair(user: IUser): Promise<TokenPair> {
    const accessToken  = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    const hashed       = await this.hashToken(refreshToken);

    await this.userRepository.updateRefreshToken(String(user._id), hashed);

    return { accessToken, refreshToken };
  }

  /**
   * Onboards a new super admin user.
   */
  async onboardSuperAdmin(superAdminData: Partial<IUser>): Promise<AuthResult> {
    try {
      const existingUser = await this.userRepository.findAll();
      if (existingUser && existingUser.length > 0) {
        throw new AppError('Super admin onboarding is disabled', 403);
      }

      const user = await this.userRepository.create(superAdminData);
      const { accessToken, refreshToken } = await this.issueTokenPair(user);

      logger.info('Admin onboarded successfully', { username: user.username });

      return { user: this.formatUserForResponse(user), accessToken, refreshToken };
    } catch (error) {
      logger.error('Error in onboarding Super admin', error);
      throw error;
    }
  }

  /**
   * Registers a new user.
   */
  async register(userData: Partial<IUser>): Promise<AuthResult> {
    try {
      const existingUser = await this.userRepository.findByUsername(userData.username!);
      if (existingUser) throw new AppError('Username already exists', 409);

      const existingEmail = await this.userRepository.findByEmail(userData.email!);
      if (existingEmail) throw new AppError('Email already exists', 409);

      const user = await this.userRepository.create(userData);
      const { accessToken, refreshToken } = await this.issueTokenPair(user);

      logger.info('User registered successfully', { username: user.username });

      return { user: this.formatUserForResponse(user), accessToken, refreshToken };
    } catch (error) {
      logger.error('Error in Register service', error);
      throw error;
    }
  }

  /**
   * Logs in a user and returns a fresh token pair.
   */
  async login(username: string, password: string): Promise<AuthResult> {
    try {
      const user = await this.userRepository.findByUsername(username);
      if (!user) throw new AppError('Invalid Credentials', 401);
      if (!user.isActive) throw new AppError('Account is deactivated', 403);

      const isPasswordValid = await this.comparePassword(password, user.password);
      if (!isPasswordValid) throw new AppError('Invalid Credentials', 401);

      const { accessToken, refreshToken } = await this.issueTokenPair(user);

      logger.info('User loggedIn successfully', { username: user.username });

      return { user: this.formatUserForResponse(user), accessToken, refreshToken };
    } catch (error) {
      logger.error('Error in Login service', error);
      throw error;
    }
  }

  /**
   * Verifies the incoming refresh token, rotates the token pair, and returns
   * a brand-new access + refresh token. The old refresh token is revoked immediately.
   */
  async refreshAccessToken(incomingRefreshToken: string): Promise<TokenPair> {
    try {
      // 1. Verify JWT signature + expiry
      let payload: { userId: string };
      try {
        payload = jwt.verify(incomingRefreshToken, config.jwt.refreshSecret) as { userId: string };
      } catch {
        throw new AppError('Invalid or expired refresh token', 401);
      }

      // 2. Load the user
      const user = await this.userRepository.findById(payload.userId);
      if (!user || !user.isActive || !user.refreshToken) {
        throw new AppError('Invalid or expired refresh token', 401);
      }

      // 3. Compare the raw incoming token against the stored bcrypt hash
      const tokenMatches = await bcrypt.compare(incomingRefreshToken, user.refreshToken);
      if (!tokenMatches) {
        // Possible token reuse attack — revoke everything
        await this.userRepository.updateRefreshToken(String(user._id), null);
        throw new AppError('Refresh token reuse detected. Please log in again.', 401);
      }

      // 4. Rotate: issue a new pair (old hash overwritten atomically)
      const newPair = await this.issueTokenPair(user);

      logger.info('Token pair rotated', { userId: user._id });
      return newPair;
    } catch (error) {
      logger.error('Error refreshing access token', error);
      throw error;
    }
  }

  /**
   * Revokes the stored refresh token for the given user (server-side logout).
   */
  async logout(userId: string): Promise<void> {
    try {
      await this.userRepository.updateRefreshToken(userId, null);
      logger.info('User logged out, refresh token revoked', { userId });
    } catch (error) {
      logger.error('Error during logout', error);
      throw error;
    }
  }

  /**
   * Fetches the profile of a user by their ID.
   */
  async getProfile(userId: string): Promise<Omit<IUser, 'password'>> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new AppError('User not found', 404);
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
