import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import {
  isValidTransition,
  isValidPhase,
  getInitialPhase,
  BusinessType,
} from '../../domain/value-objects/ConversationPhase';

export interface PhaseTransitionEntry {
  from: string;
  to: string;
  timestamp: string;
}

export interface ConversationPhaseState {
  currentPhase: string;
  businessType: BusinessType;
  history: PhaseTransitionEntry[];
}

export interface IConversationPhaseStore {
  get(conversationId: string): Promise<ConversationPhaseState>;
  set(
    conversationId: string,
    phase: string,
    businessType: BusinessType,
  ): Promise<void>;
  transition(
    conversationId: string,
    toPhase: string,
    businessType: BusinessType,
  ): Promise<boolean>;
}

export const CONVERSATION_PHASE_STORE = Symbol('CONVERSATION_PHASE_STORE');

@Injectable()
export class RedisConversationPhaseStore implements IConversationPhaseStore {
  private readonly logger = new Logger(RedisConversationPhaseStore.name);
  private readonly TTL = 7 * 24 * 60 * 60; // 7 days
  private readonly PREFIX = 'conv_phase:';
  private readonly MAX_HISTORY = 20;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async get(conversationId: string): Promise<ConversationPhaseState> {
    const key = this.getKey(conversationId);
    const data = await this.redis.get(key);

    if (!data) {
      return {
        currentPhase: getInitialPhase(),
        businessType: 'generic',
        history: [],
      };
    }

    try {
      return JSON.parse(data) as ConversationPhaseState;
    } catch {
      this.logger.warn(`conv_phase_corrupt conversationId=${conversationId}`);
      return {
        currentPhase: getInitialPhase(),
        businessType: 'generic',
        history: [],
      };
    }
  }

  async set(
    conversationId: string,
    phase: string,
    businessType: BusinessType,
  ): Promise<void> {
    const state: ConversationPhaseState = {
      currentPhase: phase,
      businessType,
      history: [],
    };
    await this.persist(conversationId, state);
  }

  async transition(
    conversationId: string,
    toPhase: string,
    businessType: BusinessType,
  ): Promise<boolean> {
    const state = await this.get(conversationId);

    if (!isValidPhase(toPhase, businessType)) {
      return false;
    }

    if (!isValidTransition(state.currentPhase, toPhase, businessType)) {
      return false;
    }

    const entry: PhaseTransitionEntry = {
      from: state.currentPhase,
      to: toPhase,
      timestamp: new Date().toISOString(),
    };

    state.history.push(entry);
    if (state.history.length > this.MAX_HISTORY) {
      state.history = state.history.slice(-this.MAX_HISTORY);
    }

    state.currentPhase = toPhase;
    state.businessType = businessType;

    await this.persist(conversationId, state);
    return true;
  }

  private async persist(
    conversationId: string,
    state: ConversationPhaseState,
  ): Promise<void> {
    const key = this.getKey(conversationId);
    await this.redis.set(key, JSON.stringify(state), 'EX', this.TTL);
  }

  private getKey(conversationId: string): string {
    return `${this.PREFIX}${conversationId}`;
  }
}
