// Type declarations for JavaScript modules used in tests

declare module '../../services/client/services/clientService.js' {
  export class ClientService {
    constructor(dependencies: {
      clientRepository: any;
      apiKeyRepository: any;
      userRepository: any;
    });
    [key: string]: any;
  }
}

declare module '../../services/client/client.container.js' {
  const clientContainer: {
    services: {
      clientServices: any;
    };
    controller: {
      clientController: any;
    };
    [key: string]: any;
  };
  export default clientContainer;
}

declare module '../../src/services/processor/service/ProcessorService.js' {
  export class ProcessorService {
    constructor(dependencies: {
      apiHitRepository: any;
      metricsRepository: any;
    });
    processEvent(eventData: any): Promise<void>;
    [key: string]: any;
  }
}

export {};

