import './instrumentation';
import { bootstrapWorkerContext } from '@shared/infrastructure/bootstrap/bootstrapWorkerContext';
import { SchedulingWorkerModule } from './workers/scheduling-worker.module';

void bootstrapWorkerContext(SchedulingWorkerModule, 'SchedulingWorker');
