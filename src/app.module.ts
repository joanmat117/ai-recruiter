import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { CommonModule } from './common/common.module';
import { LlmModule } from './modules/llm/llm.module';
import { RecruiterModule } from './modules/recruiter/recruiter.module';
import configuration from './config/configuration';
import llmConfig from './config/llm.config';
import langgraphConfig from './config/langgraph.config';
import { BullModule } from "@nestjs/bullmq"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, llmConfig, langgraphConfig],
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      }
    }),
    CommonModule,
    LlmModule,
    RecruiterModule,
  ],
  controllers: [AppController],
})
export class AppModule { }
