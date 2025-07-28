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
    const prompt = `Tu es un assistant d'inscription universitaire. Réponds de manière CONCISE et DIRECTE en français.

Intention: ${JSON.stringify(intent, null, 2)}
Résultats: ${JSON.stringify(results, null, 2)}
${studentContext ? `Contexte: ${JSON.stringify(studentContext, null, 2)}` : ''}

RÈGLES IMPORTANTES:
- Sois bref et direct
- Pas de salutations longues
- Pas de remerciements
- Pas de signature
- Va directement au point
- Maximum 2-3 phrases
- Utilise des puces pour les listes

Exemples de bonnes réponses:
- "Vous êtes inscrit à 3 cours: MTH1007 (3 crédits), INF1120 (3 crédits), FRA1002 (2 crédits). Total: 8 crédits."
- "Inscription réussie pour: Calcul I (MTH1007). Vous avez maintenant 4 cours ce trimestre."
- "Aucun cours trouvé. Veuillez vérifier votre code permanent."

Réponds maintenant:`;

    try {
      const response = await axios.post(`${this.config.baseUrl}/api/generate`, {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower temperature for more consistent responses
          num_predict: 200,  // Limit response length
          stop: ['\n\n', 'Cordialement', 'Merci', 'Bonjour'] // Stop on these words
        }
      });

      return response.data.response.trim();
    } catch (error) {
      return "Opération terminée.";
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