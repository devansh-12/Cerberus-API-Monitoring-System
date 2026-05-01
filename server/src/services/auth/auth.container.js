import MongoUserRepository from "./repositories/UserRepository.js";
import { AuthService } from "./services/authService.js";
import { AuthController } from "./controllers/authController.js";

/**
 * Container class to initialize and manage dependencies for the auth service.
 * Responsible for creating instances of repositories, services, and controllers,
 * ensuring all dependencies are properly injected.
 */
class AuthContainer {
    /**
     * Initialize the container by creating instances of repositories, services, and controllers.
     * @returns {Object} - An object containing the initialized repositories, services, and controllers
     */
    static init() {
        // Initialize repositories
        const repositories = {
            userRepository: MongoUserRepository,
        };

        // Initialize services with the required dependencies
        const services = {
            authService: new AuthService(repositories.userRepository),
        };

        // Initialize controllers with the required dependencies
        const controller = {
            authController: new AuthController(services.authService),
        };

        return { repositories, services, controller };
    }
}

const initialized = AuthContainer.init();
export { AuthContainer };
export default initialized;