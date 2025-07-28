import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { InscriptionAgentService } from './inscription-agent.service';

@Module({
  controllers: [AIController],
  providers: [AIService, InscriptionAgentService],
  exports: [AIService, InscriptionAgentService],
})
export class AIModule {}