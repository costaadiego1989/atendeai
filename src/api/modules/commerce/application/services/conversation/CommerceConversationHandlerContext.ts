import { CommerceSessionRecord } from '../../../domain/ports/ICommerceRepository';
import { AdvanceCommerceConversationInput } from '../../use-cases/AdvanceCommerceConversationUseCase';

export interface CommerceConversationHandlerContext {
  input: AdvanceCommerceConversationInput;
  session: CommerceSessionRecord;
  userMessage: string;
  normalizedMessage: string;
}
