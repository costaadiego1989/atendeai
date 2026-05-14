import { Entity } from '../../../../shared/domain/Entity.js';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID.js';
import { ValidationErrorException } from '../../../../shared/domain/exceptions/DomainExceptions.js';

export type ToneType = 'FRIENDLY' | 'PROFESSIONAL' | 'CASUAL';

interface AIConfigProps {
  systemPrompt: string;
  tone: ToneType;
  language: string;
  maxTokensPerResponse: number;
  confidenceThreshold: number;
  escalationMessage: string | null;
  businessRules: string[];
  salesInstructions: string | null;
  updatedAt: Date;
}

export class AIConfig extends Entity<AIConfigProps> {
  private constructor(
    props: AIConfigProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  get systemPrompt(): string {
    return this.props.systemPrompt;
  }

  get tone(): ToneType {
    return this.props.tone;
  }

  get language(): string {
    return this.props.language;
  }

  get maxTokensPerResponse(): number {
    return this.props.maxTokensPerResponse;
  }

  get confidenceThreshold(): number {
    return this.props.confidenceThreshold;
  }

  get escalationMessage(): string | null {
    return this.props.escalationMessage;
  }

  get businessRules(): string[] {
    return this.props.businessRules;
  }

  get salesInstructions(): string | null {
    return this.props.salesInstructions;
  }

  public static create(
    props: Omit<AIConfigProps, 'updatedAt' | 'salesInstructions'> & {
      salesInstructions?: string | null;
    },
    id?: UniqueEntityID,
  ): AIConfig {
    if (!props.systemPrompt || props.systemPrompt.trim().length < 10) {
      throw new ValidationErrorException('System prompt must have at least 10 characters');
    }
    if (props.confidenceThreshold < 0 || props.confidenceThreshold > 1) {
      throw new ValidationErrorException('Confidence threshold must be between 0 and 1');
    }
    if (props.maxTokensPerResponse < 50 || props.maxTokensPerResponse > 4000) {
      throw new ValidationErrorException('Max tokens must be between 50 and 4000');
    }
    return new AIConfig(
      {
        ...props,
        salesInstructions: props.salesInstructions || null,
        updatedAt: new Date(),
      },
      id,
    );
  }

  public static reconstitute(
    props: AIConfigProps,
    id: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ): AIConfig {
    return new AIConfig(props, id, createdAt, updatedAt);
  }
}
