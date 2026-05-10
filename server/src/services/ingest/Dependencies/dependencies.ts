import { createEventProducer } from '../../../shared/events/producers/createEventProducer.js';
import { IngestController } from '../controllers/ingestController.js';
import { IngestService } from '../services/ingestService.js';

/**
 * Container class for managing dependencies in the ingest module.
 */
class Container {
  static init() {
    const eventProducer = createEventProducer();

    const services = {
      ingestService: new IngestService({ eventProducer }),
    };

    const controllers = {
      ingestController: new IngestController(services),
    };

    return { services, controllers };
  }
}

// Initialize the container and export the services and controllers
const container = Container.init();
export default {
  ingestService: container.services.ingestService,
  ingestController: container.controllers.ingestController,
  Container,
};
