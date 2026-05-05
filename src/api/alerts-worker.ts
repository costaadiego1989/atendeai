import './instrumentation';
import { bootstrapWorkerContext } from '@shared/infrastructure/bootstrap/bootstrapWorkerContext';
import { AlertsWorkerModule } from './workers/alerts-worker.module';

void bootstrapWorkerContext(AlertsWorkerModule, 'AlertsWorker');
