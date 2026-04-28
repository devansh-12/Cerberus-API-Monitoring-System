import MongoClientRepository from "./repositories/ClientRepository.js";
import MongoApiKeyRepository from "./repositories/ApiKeyRepository.js";
import MongoUserRepository from "../auth/repositories/UserRepository.js";
import { ClientService } from "./services/clientService.js";
import { ClientController } from "./controllers/clientController.js";
import authContainer from "../auth/auth.container.js";

/**
 * Container class to initialize and manage dependencies for the client service.
 * Responsible for creating instances of repositories, services, and controllers,
 * ensuring all dependencies are properly injected.
 */
class ClientContainer {
    /**
     * Initialize the container by creating instances of repositories, services, and controllers.
     * @returns {Object} - An object containing the initialized repositories, services, and controllers
     */
    static init() {
        // Initialize repositories
        const repositories = {
            clientRepository: MongoClientRepository,
            apiKeyRepository: MongoApiKeyRepository,
            userRepository: MongoUserRepository,
        };

        // Initialize services with the required dependencies
        const services = {
            clientServices: new ClientService({
                clientRepository: repositories.clientRepository,
                apiKeyRepository: repositories.apiKeyRepository,
                userRepository: repositories.userRepository,
            }),
        };

        // Initialize controllers with the required dependencies
        const controller = {
            clientController: new ClientController(
                services.clientServices,
                authContainer.services.authService
            ),
        };

        return { repositories, services, controller };
    }
}

const initialized = ClientContainer.init();
export { ClientContainer };
export default initialized;
