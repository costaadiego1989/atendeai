import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatModelFactory } from './models/ChatModelFactory';
import { StructuredOutputChainFactory } from './chains/StructuredOutputChainFactory';
import { TextOutputChainFactory } from './chains/TextOutputChainFactory';

@Module({
  imports: [ConfigModule],
  providers: [
    ChatModelFactory,
    StructuredOutputChainFactory,
    TextOutputChainFactory,
  ],
  exports: [
    ChatModelFactory,
    StructuredOutputChainFactory,
    TextOutputChainFactory,
  ],
})
export class LangChainModule {}
