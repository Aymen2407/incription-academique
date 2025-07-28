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
    const prompt = `Tu es un expert en analyse d'intentions pour un système d'inscription académique. Ton travail est de distinguer précisément entre les différentes actions.

CONTEXTE ÉTUDIANT: ${context ? JSON.stringify(context, null, 2) : 'Code permanent fourni - étudiant identifié'}

MESSAGE ÉTUDIANT: "${message}"

ACTIONS DISPONIBLES ET LEURS CRITÈRES PRÉCIS:

🎯 RECOMMANDER_COURS - Recommandations personnalisées pour UN étudiant spécifique
MOTS-CLÉS: "recommander", "recommande", "suggère", "suggérer", "conseille", "conseiller", "pour moi", "mon programme", "mes cours", "adapté à"
CONTEXTE REQUIS: Code permanent fourni
EXEMPLE: "Recommande-moi 3 cours", "Suggère des cours pour mon programme", "Quels cours devrais-je prendre?"

🔍 CHERCHER_COURS - Recherche générale de cours (pas personnalisée)
MOTS-CLÉS: "cherche", "chercher", "trouve", "trouver", "liste", "quels sont", "voir les cours", "cours disponibles"
CONTEXTE: Peu importe si code permanent fourni ou pas
EXEMPLE: "Je cherche des cours en informatique", "Quels sont les cours de math?", "Liste des cours disponibles"

👀 VOIR_COURS - Voir LES cours actuels de l'étudiant
MOTS-CLÉS: "mes cours actuels", "cours que je suis", "mes inscriptions", "où je suis inscrit"
EXEMPLE: "Montre-moi mes cours actuels", "Dans quels cours suis-je inscrit?"

ANALYSE DU MESSAGE ACTUEL:
Le message "${message}" contient-il:
- Le mot "recommander/recommande/suggère" → OUI/NON
- Une demande personnalisée ("pour moi", "mon programme") → OUI/NON  
- Un code permanent est-il fourni → OUI/NON
- S'agit-il d'une recherche générale → OUI/NON

RÈGLE ABSOLUE:
- Si le message contient "recommand*", "suggèr*", "conseil*" + code permanent → RECOMMANDER_COURS
- Si le message contient "cherch*", "trouv*", "liste*" → CHERCHER_COURS
- Si le message parle de "mes cours actuels" → VOIR_COURS

Réponds UNIQUEMENT en JSON valide:
{
  "action": "RECOMMANDER_COURS",
  "confiance": 0.98,
  "parametres": {
    "code_permanant": "${context ? 'fourni' : null}",
    "nombre_cours": 4,
    "pour_programme": true,
    "trimestre_actuel": true,
    "personnalise": true
  },
  "raisonnement": "Le message contient 'recommander' et 'mon programme' avec un code permanent fourni = demande personnalisée"
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