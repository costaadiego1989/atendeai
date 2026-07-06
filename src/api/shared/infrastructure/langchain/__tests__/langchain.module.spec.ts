import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { LangChainModule } from '../langchain.module';
import { ChatModelFactory } from '../models/ChatModelFactory';
import { StructuredOutputChainFactory } from '../chains/StructuredOutputChainFactory';
import { TextOutputChainFactory } from '../chains/TextOutputChainFactory';

describe('LangChainModule', () => {
  it('provides ChatModelFactory, StructuredOutputChainFactory, TextOutputChainFactory', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [() => ({ OPENAI_API_KEY: 'test' })] }),
        LangChainModule,
      ],
    }).compile();

    expect(module.get(ChatModelFactory)).toBeInstanceOf(ChatModelFactory);
    expect(module.get(StructuredOutputChainFactory)).toBeInstanceOf(StructuredOutputChainFactory);
    expect(module.get(TextOutputChainFactory)).toBeInstanceOf(TextOutputChainFactory);
  });
});
