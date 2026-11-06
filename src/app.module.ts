import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { CommonModule } from './common/common.module';
import { LlmModule } from './modules/llm/llm.module';
import { RecruiterModule } from './modules/recruiter/recruiter.module';
import configuration from './config/configuration';
import llmConfig from './config/llm.config';
import langgraphConfig from './config/langgraph.config';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, llmConfig, langgraphConfig],
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: parseInt(configService.get('REDIS_PORT') || '6379', 10),
        },
      }),
      inject: [ConfigService],
    }),
    CommonModule,
    LlmModule,
    RecruiterModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
