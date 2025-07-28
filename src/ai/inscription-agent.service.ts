import { Injectable, Logger } from '@nestjs/common';
import { AIService } from './ai.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class InscriptionAgentService {
  private readonly logger = new Logger(InscriptionAgentService.name);

  constructor(
    private readonly aiService: AIService,
    private readonly databaseService: DatabaseService,
  ) {}

  async processStudentRequest(message: string, codePermanent?: string): Promise<any> {
    try {
      // Fix the typo: analyizeInscriptionRequest -> analyzeInscriptionRequest
      const intent = await this.aiService.analyzeInscriptionRequest(message);

      // Obtenir le contexte étudiant si disponible
      const studentContext = codePermanent ? await this.getStudentContext(codePermanent) : null;

      // Exécuter l'opération demandée
      const results = await this.executeOperation(intent, studentContext);

      // Générer une réponse directe
      const response = await this.generateContextualResponse(intent, results, studentContext);

      return {
        success: true,
        intent: intent,
        results: results,
        response: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Inscription Agent Error:', error);
      return {
        success: false,
        error: error.message,
        response: "Erreur lors du traitement de la demande.",
        timestamp: new Date().toISOString()
      };
    }
  }

  private async getStudentContext(codePermanent: string): Promise<any> {
    try {
      // Use Prisma method to get student
      const etudiant = await this.databaseService.etudiants.findUnique({
        where: { code_permanant: codePermanent },
        include: {
          programmes: true,
        }
      });

      if (!etudiant) {
        throw new Error('Étudiant non trouvé');
      }

      // Get current inscriptions
      const inscriptions = await this.databaseService.inscription.findMany({
        where: {
          code_permanant: codePermanent,
          statut_inscription: 'Inscrit'
        },
        include: {
          plan_de_formation: {
            include: {
              cours: true
            }
          }
        }
      });

      const totalCredits = inscriptions.reduce((sum, inscription) => {
        return sum + Number(inscription.plan_de_formation.cours.cr_dits);
      }, 0);

      return {
        etudiant,
        inscriptions_actuelles: inscriptions,
        total_credits: totalCredits
      };
    } catch (error) {
      this.logger.error('Erreur contexte étudiant:', error);
      return null;
    }
  }

  private async executeOperation(intent: any, studentContext: any): Promise<any> {
    const { action, parametres } = intent;

    switch (action) {
      case 'INSCRIRE_COURS':
        return await this.handleInscription(parametres, studentContext);

      case 'VOIR_COURS':
        return await this.handleViewCours(studentContext);

      case 'CHERCHER_COURS':
        return await this.handleSearchCours(parametres);

      case 'INFO_ETUDIANT':
        return await this.handleStudentInfo(studentContext);

      default:
        throw new Error(`Action inconnue: ${action}`);
    }
  }

  private async handleSearchCours(params: any): Promise<any> {
    try {
      const searchTerm = params.criteres_recherche || '';

      // Use Prisma to search courses (SQL Server doesn't support case insensitive mode)
      const courses = await this.databaseService.cours.findMany({
        where: {
          OR: [
            { titre: { contains: searchTerm } },
            { d_partement: { contains: searchTerm } },
            { sigle: { startsWith: this.mapSearchTermToCode(searchTerm) } },
            { contenu: { contains: searchTerm } },
            { objectifs: { contains: searchTerm } }
          ]
        },
        orderBy: [
          { d_partement: 'asc' },
          { sigle: 'asc' }
        ]
      });

      return courses;
    } catch (error) {
      this.logger.error('Search error:', error);
      return [];
    }
  }
  private mapSearchTermToCode(searchTerm: string): string {
    const termLower = searchTerm.toLowerCase();

    const mappings: { [key: string]: string } = {
      'informatique': 'INF',
      'computer science': 'INF',
      'programmation': 'INF',
      'mathématiques': 'MTH',
      'math': 'MTH',
      'physique': 'PHY',
      'chimie': 'CHM',
      'français': 'FRA',
      'anglais': 'ANG'
    };

    return mappings[termLower] || termLower.toUpperCase().substring(0, 3);
  }

  private async handleViewCours(studentContext: any): Promise<any> {
    return {
      inscriptions_actuelles: studentContext?.inscriptions_actuelles || [],
      total_credits: studentContext?.total_credits || 0,
      etudiant: studentContext?.etudiant
    };
  }

  private async handleInscription(params: any, studentContext: any): Promise<any> {
    if (!studentContext?.etudiant) {
      throw new Error('Étudiant non trouvé');
    }

    let coursToRegister = [];

    if (params.sigles_cours && params.sigles_cours.length > 0) {
      // Specific courses mentioned
      coursToRegister = await this.databaseService.cours.findMany({
        where: {
          sigle: { in: params.sigles_cours }
        }
      });
    } else if (params.nombre_cours) {
      // Get available courses for the student's program
      const availableCours = await this.databaseService.cours.findMany({
        where: {
          plan_de_formation: {
            some: {
              code: studentContext.etudiant.code_programme
            }
          }
        },
        take: params.nombre_cours
      });

      coursToRegister = availableCours;
    }

    // For now, just return the courses that would be registered
    return {
      message: 'Inscription simulation - not yet implemented',
      courses_to_register: coursToRegister
    };
  }

  private async handleStudentInfo(studentContext: any): Promise<any> {
    return studentContext;
  }

  private async generateContextualResponse(intent: any, results: any, studentContext?: any): Promise<string> {
    const { action } = intent;

    switch (action) {
      case 'VOIR_COURS':
        return this.formatCoursListResponse(results, studentContext);

      case 'CHERCHER_COURS':
        return this.formatSearchResponse(results);

      case 'INFO_ETUDIANT':
        return this.formatStudentInfoResponse(studentContext);

      case 'INSCRIRE_COURS':
        return this.formatInscriptionResponse(results);

      default:
        return "Demande traitée.";
    }
  }

  private formatCoursListResponse(results: any, studentContext: any): string {
    if (!studentContext?.inscriptions_actuelles || studentContext.inscriptions_actuelles.length === 0) {
      return "Aucun cours inscrit actuellement.";
    }

    const coursList = studentContext.inscriptions_actuelles.map((inscription: any) => {
      const cours = inscription.plan_de_formation?.cours;
      return `${cours?.titre || 'N/A'} (${cours?.sigle}) - ${cours?.cr_dits || 0} crédits`;
    }).join('\n• ');

    return `Cours actuels:\n• ${coursList}\n\nTotal: ${studentContext.total_credits} crédits`;
  }

  private formatSearchResponse(results: any): string {
    if (!results || results.length === 0) {
      return "Aucun cours trouvé pour ce critère de recherche.";
    }

    if (results.length > 10) {
      const first10 = results.slice(0, 10);
      const courseList = first10.map((c: any) =>
        `${c.sigle} - ${c.titre} (${c.cr_dits} crédits) - ${c.d_partement}`
      ).join('\n• ');

      return `${results.length} cours trouvés. Voici les 10 premiers:\n\n• ${courseList}\n\n... et ${results.length - 10} autres cours.`;
    }

    const courseList = results.map((c: any) =>
      `${c.sigle} - ${c.titre} (${c.cr_dits} crédits) - ${c.d_partement}`
    ).join('\n• ');

    return `${results.length} cours trouvé${results.length > 1 ? 's' : ''}:\n\n• ${courseList}`;
  }

  private formatInscriptionResponse(results: any): string {
    if (results.courses_to_register && results.courses_to_register.length > 0) {
      const courseList = results.courses_to_register.map((c: any) =>
        `${c.sigle} - ${c.titre}`
      ).join('\n• ');

      return `Cours trouvés pour inscription:\n• ${courseList}\n\n${results.message}`;
    }

    return results.message || "Aucun cours trouvé pour inscription.";
  }

  private formatStudentInfoResponse(studentContext: any): string {
    if (!studentContext?.etudiant) {
      return "Informations étudiant non trouvées.";
    }

    const etudiant = studentContext.etudiant;
    return `${etudiant.prenom} ${etudiant.nom} (${etudiant.code_permanant})
Programme: ${etudiant.programmes?.libell_ || etudiant.code_programme}
Statut: ${etudiant.statut}
Cours actuels: ${studentContext.inscriptions_actuelles?.length || 0}
Total crédits: ${studentContext.total_credits || 0}`;
  }
}