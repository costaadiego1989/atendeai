import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { AgentModule } from '../../domain/enums/AgentModule';
import {
  MAX_AGENT_RULE_PROMPT_LENGTH,
  normalizeAgentPrompt,
  parseAgentModule,
} from './agentRuleDraft';

describe('agentRuleDraft', () => {
  describe('parseAgentModule', () => {
    it('resolve um modulo permitido', () => {
      expect(parseAgentModule(AgentModule.MESSAGING)).toBe(
        AgentModule.MESSAGING,
      );
    });

    it('recusa modulo desconhecido', () => {
      expect(() => parseAgentModule('INVALID')).toThrow(
        ValidationErrorException,
      );
    });
  });

  describe('normalizeAgentPrompt', () => {
    it('faz trim e aceita dentro do limite', () => {
      expect(normalizeAgentPrompt('  olá mundo  ')).toBe('olá mundo');
    });

    it('recusa texto acima do limite maximo', () => {
      const long = 'a'.repeat(MAX_AGENT_RULE_PROMPT_LENGTH + 1);
      expect(() => normalizeAgentPrompt(long)).toThrow(ValidationErrorException);
    });
  });
});
