import './instrumentation';
import { bootstrapWorkerContext } from '@shared/infrastructure/bootstrap/bootstrapWorkerContext';
import { MessagingWorkerModule } from './workers/messaging-worker.module';

void bootstrapWorkerContext(MessagingWorkerModule, 'MessagingWorker');
