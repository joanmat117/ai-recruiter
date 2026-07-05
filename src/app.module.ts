import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { LlmModule } from './modules/llm/llm.module';
import { RecruiterModule } from './agents/recruiter/recruiter.module';
import configuration from './config/configuration';
import llmConfig from './config/llm.config';
import langgraphConfig from './config/langgraph.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, llmConfig, langgraphConfig],
    }),
    EventEmitterModule.forRoot(),
    CommonModule,
    LlmModule,
    RecruiterModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
