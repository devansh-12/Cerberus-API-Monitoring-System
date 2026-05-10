import { AuthController } from '../controllers/authController.js';
import { AuthService } from '../services/authService.js';
import MongoUserRepository from '../repositories/UserRepository.js';

/**
 * Dependency Injection Container for the Auth module.
 */
const container = {
  repositories: {
    userRepository: MongoUserRepository,
  },
  services: {
    authService: null as AuthService | null,
  },
  controller: {
    authController: null as AuthController | null,
  },
};

// Initialize services
container.services.authService = new AuthService(container.repositories.userRepository);

// Initialize controllers
container.controller.authController = new AuthController(container.services.authService);

export { container as Container };
export default container;
