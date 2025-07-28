import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface AIConfig {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private config: AIConfig;

  constructor() {
    this.config = {
      baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.AI_MODEL || 'llama3.2:3b',
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.1'),
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000'),
    };
  }

  async analyzeInscriptionRequest(message: string, context?: any): Promise<any> {
    const prompt = `Tu es un assistant d'inscription académique pour une université. Analyse cette demande d'étudiant et détermine l'action à effectuer.

Actions disponibles:
- INSCRIRE_COURS: L'étudiant veut s'inscrire à des cours
- VOIR_COURS: L'étudiant veut voir ses cours actuels
- DESINSCRIRE_COURS: L'étudiant veut se désinscrire de cours
- CHERCHER_COURS: L'étudiant veut chercher des cours disponibles
- INFO_ETUDIANT: L'étudiant veut voir ses informations

Message de l'étudiant: "${message}"
${context ? `Contexte: ${JSON.stringify(context, null, 2)}` : ''}

Réponds en JSON avec cette structure:
{
  "action": "ACTION_NAME",
  "confiance": 0.95,
  "parametres": {
    "code_permanant": "code si mentionné",
    "nombre_cours": "nombre si spécifié",
    "sigles_cours": ["liste des sigles si mentionnés"],
    "trimestre": "trimestre si mentionné",
    "criteres_recherche": "critères additionnels"
  },
  "raisonnement": "pourquoi cette action a été choisie"
}`;

    return await this.generateStructuredResponse(prompt);
  }

  private async generateStructuredResponse(prompt: string): Promise<any> {
    try {
      const response = await axios.post(`${this.config.baseUrl}/api/generate`, {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens
        }
      });

      // Extract JSON from response
      const jsonMatch = response.data.response.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Invalid response format' };
    } catch (error) {
      this.logger.error('AI Service Error:', error);
      throw new Error(`Erreur de traitement IA: ${error.message}`);
    }
  }

  async generateFriendlyResponse(intent: any, results: any, studentContext?: any): Promise<string> {
    const prompt = `Génère une réponse amicale et naturelle en français pour l'étudiant.

Intention analysée: ${JSON.stringify(intent, null, 2)}
Résultats de l'opération: ${JSON.stringify(results, null, 2)}
${studentContext ? `Contexte étudiant: ${JSON.stringify(studentContext, null, 2)}` : ''}

Crée une réponse qui:
- Confirme ce qui a été fait
- Mentionne les détails spécifiques (noms de cours, crédits, etc.)
- Est encourageante et professionnelle
- Inclut des conseils ou prochaines étapes si pertinent
- Sonne comme un conseiller pédagogique serviable`;

    try {
      const response = await axios.post(`${this.config.baseUrl}/api/generate`, {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 1000
        }
      });

      return response.data.response.trim();
    } catch (error) {
      this.logger.error('Error generating friendly response:', error);
      return "Votre demande a été traitée avec succès!";
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await axios.get(`${this.config.baseUrl}/api/tags`);
      return true;
    } catch (error) {
      this.logger.error('AI Health Check Failed:', error);
      return false;
    }
  }
}