import { Controller, Post, Get, Body, HttpStatus, HttpException } from '@nestjs/common';
import { InscriptionAgentService } from './inscription-agent.service';
import { AIService } from './ai.service';

export class ChatInscriptionDto {
  message: string;
  code_permanent?: string;
}

@Controller('ai')
export class AIController {
  constructor(
    private readonly inscriptionAgentService: InscriptionAgentService,
    private readonly aiService: AIService,
  ) {}

  @Post('chat-inscription')
  async chatInscription(@Body() body: ChatInscriptionDto) {
    const { message, code_permanent } = body;

    if (!message) {
      throw new HttpException('Le message est requis', HttpStatus.BAD_REQUEST);
    }

    // Vérifier si le service IA est disponible
    const isHealthy = await this.aiService.healthCheck();
    if (!isHealthy) {
      throw new HttpException(
        'Le service IA n\'est pas disponible. Veuillez vous assurer qu\'Ollama fonctionne.',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    return await this.inscriptionAgentService.processStudentRequest(message, code_permanent);
  }

  @Get('health')
  async healthCheck() {
    const isHealthy = await this.aiService.healthCheck();

    return {
      healthy: isHealthy,
      timestamp: new Date().toISOString(),
      message: isHealthy ? 'Service IA opérationnel' : 'Service IA indisponible'
    };
  }
}