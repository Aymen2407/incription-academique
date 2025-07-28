import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { InscriptionAgentService } from './inscription-agent.service';
import { DatabaseService } from '../database/database.service';

@Module({
  controllers: [AIController],
  providers: [AIService, InscriptionAgentService, DatabaseService],
  exports: [AIService, InscriptionAgentService],
})
export class AIModule {}