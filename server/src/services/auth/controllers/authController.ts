import { Request, Response, NextFunction } from 'express';
import config from '../../../shared/config/index.js';
import ResponseFormatter from '../../../shared/utils/responseFormatter.js';
import { AuthService } from '../services/authService.js';

/**
 * AuthController handles user authentication and authorization.
 */
export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    if (!authService) {
      throw new Error('authService is Required');
    }
    this.authService = authService;
  }

  /**
   * Onboards a new super admin user.
   */
  async onboardSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, email, password } = req.body;

      const superAdminData = {
        username,
        email,
        password,
        role: 'super_admin',
      };

      const { token, user } = await this.authService.onboardSuperAdmin(superAdminData);

      res.cookie('authToken', token, {
        httpOnly: config.cookie.httpOnly,
        secure: config.cookie.secure,
        maxAge: config.cookie.expiresIn,
      });

      res.status(201).json(ResponseFormatter.success(user, 'Super admin created successfully', 201));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Registers a new user.
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, email, password, role } = req.body;
      const userData = {
        username,
        email,
        password,
        role: role || 'client_viewer',
      };

      const { token, user } = await this.authService.register(userData);

      res.cookie('authToken', token, {
        httpOnly: config.cookie.httpOnly,
        secure: config.cookie.secure,
        maxAge: config.cookie.expiresIn,
      });

      res.status(201).json(ResponseFormatter.success(user, 'User created successfully', 201));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logs in a user.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = req.body;
      const { user, token } = await this.authService.login(username, password);

      res.cookie('authToken', token, {
        httpOnly: config.cookie.httpOnly,
        secure: config.cookie.secure,
        maxAge: config.cookie.expiresIn,
      });

      res.status(200).json(ResponseFormatter.success(user, 'User LoggedIn successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetches the profile of the logged-in user.
   */
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any).userId;
      const result = await this.authService.getProfile(userId);

      res.status(200).json(ResponseFormatter.success(result, 'Profile fetched successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logs out the currently logged-in user.
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie('authToken');
      res.status(200).json(ResponseFormatter.success({}, 'Logout successful', 200));
    } catch (error) {
      next(error);
    }
  }
}
