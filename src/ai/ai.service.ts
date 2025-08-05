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
      model: process.env.AI_MODEL || 'mistral-nemo:12b',
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.1'),
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000'),
    };
  }

  async analyzeInscriptionRequest(message: string, context?: any): Promise<any> {
    const prompt = `Tu es un expert en analyse d'intentions pour un système d'inscription académique.

CONTEXTE ÉTUDIANT: ${context ? JSON.stringify(context, null, 2) : 'Code permanent fourni'}

MESSAGE ÉTUDIANT: "${message}"

ACTIONS DISPONIBLES:

🎯 INSCRIRE_COURS - Inscription à des cours spécifiques
MOTS-CLÉS: "inscris", "inscrire", "inscription", "je veux m'inscrire", "enregistre-moi"
PARAMÈTRES REQUIS: sigles de cours, trimestre
EXEMPLE: "inscris-moi au cours INF1062", "je veux m'inscrire à MTH1007 pour l'automne 2025"

❌ DESINSCRIRE_COURS - Retrait/abandon de cours
MOTS-CLÉS: "désinscrire", "desinscrire", "retirer", "abandonner", "enlever", "supprimer", "drop", "remove"
PARAMÈTRES REQUIS: sigles de cours, trimestre (optionnel)
EXEMPLE: "désinscrire-moi du cours INF1062", "je veux abandonner MTH1007", "retirer INF1563 de mon horaire"

🎯 RECOMMANDER_COURS - Recommandations personnalisées
MOTS-CLÉS: "recommander", "suggère", "conseille"

🔍 CHERCHER_COURS - Recherche de cours
MOTS-CLÉS: "cherche", "liste", "cours disponibles"

👀 VOIR_COURS - Cours actuels de l'étudiant
MOTS-CLÉS: "mes cours actuels"

ANALYSE SPÉCIALE POUR DÉSINSCRIPTIONS:
Le message "${message}" contient-il:
- Verbe de désinscription: "désinscrire", "retirer", "abandonner", "enlever", "supprimer" → OUI/NON
- Sigles de cours: recherche des codes comme INF1062, MTH1007, etc.
- Trimestre: automne, hiver, été + année (optionnel pour désinscription)

EXTRACTION AUTOMATIQUE:
- Sigles détectés: ${this.extractCourseSigles(message)}
- Trimestre détecté: ${this.extractTrimestre(message)}
- Action désinscription: ${this.hasDesinscriptionKeywords(message) ? 'DESINSCRIRE_COURS' : 'AUTRE'}
- Action inscription: ${message.toLowerCase().includes('inscri') ? 'INSCRIRE_COURS' : 'AUTRE'}

IMPORTANT: Les trimestres dans la base de données sont stockés comme:
- "Automne 2025" (pas A2025)
- "Hiver 2026" (pas H2026)  
- "Été 2025" (pas E2025)

Réponds UNIQUEMENT en JSON valide:
{
  "action": "DESINSCRIRE_COURS",
  "confiance": 0.98,
  "parametres": {
    "sigles_cours": ["INF1563"],
    "trimestre": "Automne 2025",
    "trimestre_reel": "Automne 2025",
    "annee": 2025,
    "validation_requise": true
  },
  "raisonnement": "Demande explicite de désinscription avec sigle spécifié"
}`;

    return await this.generateStructuredResponse(prompt);
  }

  private extractCourseSigles(message: string): string[] {
    // Match course codes like INF1062, MTH1007, etc.
    const sigles = message.match(/[A-Z]{3}\d{4}/gi) || [];
    return sigles.map(s => s.toUpperCase());
  }

  private extractTrimestre(message: string): string | null {
    const trimLower = message.toLowerCase();
    const currentYear = new Date().getFullYear();

    // Look for year first
    const yearMatch = message.match(/20(\d{2})/);
    const year = yearMatch ? yearMatch[0] : currentYear.toString();

    // Return full format as stored in database
    if (trimLower.includes('automne')) return `Automne ${year}`;
    if (trimLower.includes('hiver')) return `Hiver ${year}`;
    if (trimLower.includes('été') || trimLower.includes('ete')) return `Été ${year}`;

    return null;
  }

  private hasDesinscriptionKeywords(message: string): boolean {
    const desinscriptionWords = [
      'désinscrire', 'desinscrire', 'retirer', 'abandonner',
      'enlever', 'supprimer', 'drop', 'remove', 'annuler'
    ];

    const messageLower = message.toLowerCase();
    return desinscriptionWords.some(word => messageLower.includes(word));
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
- "Désinscription réussie: INF1563 - Programmation I. Cours retiré de votre horaire."
- "Aucun cours trouvé. Veuillez vérifier votre code permanent."

Réponds maintenant:`;

    try {
      const response = await axios.post(`${this.config.baseUrl}/api/generate`, {
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 200,
          stop: ['\n\n', 'Cordialement', 'Merci', 'Bonjour']
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