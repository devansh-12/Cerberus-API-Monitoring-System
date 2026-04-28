import ResponseFormatter from "../../../shared/utils/responseFormatter.js";

/**
 * @description ClientController handles client management operations such as
 * onboarding clients, creating client users, and managing API keys.
 * It interacts with the ClientService and AuthService to perform these operations.
 */
export class ClientController {
    constructor(clientService, authService) {
        if (!clientService) {
            throw new Error("clientService is Required");
        }
        if (!authService) {
            throw new Error("authService is Required");
        }

        this.clientService = clientService;
        this.authService = authService;
    }

    /**
     * Onboards a new client.
     * @param {Request} req - The request object.
     * @param {Response} res - The response object.
     * @param {Function} next - The next middleware function.
     */
    async createClient(req, res, next) {
        try {
            const clientData = req.body;
            const adminUser = req.user;

            const client = await this.clientService.createClient(clientData, adminUser);
            res.status(201).json(ResponseFormatter.success(client, "Client created successfully", 201));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Creates a new user for a specific client.
     * @param {Request} req - The request object.
     * @param {Response} res - The response object.
     * @param {Function} next - The next middleware function.
     */
    async createClientUser(req, res, next) {
        try {
            const { clientId } = req.params;
            const userData = req.body;
            const adminUser = req.user;

            const user = await this.clientService.createClientUser(clientId, userData, adminUser);
            res.status(201).json(ResponseFormatter.success(user, "Client user created successfully", 201));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Creates a new API key for a specific client.
     * @param {Request} req - The request object.
     * @param {Response} res - The response object.
     * @param {Function} next - The next middleware function.
     */
    async createApiKey(req, res, next) {
        try {
            const { clientId } = req.params;
            const keyData = req.body;
            const user = req.user;

            const apiKey = await this.clientService.createApiKey(clientId, keyData, user);
            res.status(201).json(ResponseFormatter.success(apiKey, "API key created successfully", 201));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Gets all API keys for a specific client.
     * @param {Request} req - The request object.
     * @param {Response} res - The response object.
     * @param {Function} next - The next middleware function.
     */
    async getClientApiKeys(req, res, next) {
        try {
            const { clientId } = req.params;
            const user = req.user;

            const apiKeys = await this.clientService.getClientApiKeys(clientId, user);
            res.status(200).json(ResponseFormatter.success(apiKeys, "API keys fetched successfully", 200));
        } catch (error) {
            next(error);
        }
    }
}