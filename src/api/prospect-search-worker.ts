import './instrumentation';
import { bootstrapWorkerContext } from '@shared/infrastructure/bootstrap/bootstrapWorkerContext';
import { ProspectSearchWorkerModule } from './workers/prospect-search-worker.module';

void bootstrapWorkerContext(ProspectSearchWorkerModule, 'ProspectSearchWorker');
