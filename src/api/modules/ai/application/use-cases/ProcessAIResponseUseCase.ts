import {
  IProcessAIResponseUseCase,
  ProcessAIResponseInput,
  ProcessAIResponseOutput,
} from './interfaces/IProcessAIResponseUseCase';
import { ProcessAIResponseService } from '../services/ProcessAIResponseService';

export class ProcessAIResponseUseCase implements IProcessAIResponseUseCase {
  constructor(private readonly processAIResponseService: ProcessAIResponseService) {}

  async execute(input: ProcessAIResponseInput): Promise<ProcessAIResponseOutput> {
    return this.processAIResponseService.process(input);
  }
}
