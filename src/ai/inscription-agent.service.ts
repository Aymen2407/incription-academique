import { Injectable, Logger } from '@nestjs/common';
import { AIService } from './ai.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class InscriptionAgentService {
  private readonly logger = new Logger(InscriptionAgentService.name);

  constructor(
    private readonly aiService: AIService,
    private readonly prisma: PrismaService,
  ) {}

  async processStudentRequest(message: string, codePermanent?: string): Promise<any> {
    try {
      // Analyser l'intention avec l'IA
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
      // Get student info
      const etudiant = await this.prisma.etudiants.findUnique({
        where: { code_permanant: codePermanent },
        include: {
          programmes: true,
        }
      });

      if (!etudiant) {
        throw new Error('Étudiant non trouvé');
      }

      // Get current inscriptions
      const inscriptions = await this.prisma.inscription.findMany({
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

      case 'DESINSCRIRE_COURS':
        return await this.handleDesinscription(parametres, studentContext);

      case 'CHERCHER_COURS':
        return await this.handleSearchCours(parametres);

      case 'INFO_ETUDIANT':
        return await this.handleStudentInfo(studentContext);

      default:
        throw new Error(`Action inconnue: ${action}`);
    }
  }

  private async handleInscription(params: any, studentContext: any): Promise<any> {
    if (!studentContext?.etudiant) {
      throw new Error('Étudiant non trouvé');
    }

    let coursToRegister = [];

    if (params.sigles_cours && params.sigles_cours.length > 0) {
      // Specific courses mentioned
      coursToRegister = await this.prisma.cours.findMany({
        where: {
          sigle: { in: params.sigles_cours }
        }
      });
    } else if (params.nombre_cours) {
      // AI should suggest courses based on program
      const availableCours = await this.getAvailableCoursForStudent(
        studentContext.etudiant.code_programme,
        studentContext.etudiant.code_permanant
      );

      coursToRegister = await this.aiSelectCours(availableCours, studentContext, params.nombre_cours);
    }

    // Perform registrations
    const results = [];
    const currentYear = new Date().getFullYear();
    const trimestre = params.trimestre || 'A2024';

    for (const cours of coursToRegister) {
      try {
        // Check if plan de formation exists
        const planExists = await this.prisma.plan_de_formation.findFirst({
          where: {
            code: studentContext.etudiant.code_programme,
            sigle: cours.sigle
          }
        });

        if (!planExists) {
          results.push({
            ...cours,
            success: false,
            error: 'Cours non disponible dans votre programme'
          });
          continue;
        }

        // Check if already registered
        const existingInscription = await this.prisma.inscription.findFirst({
          where: {
            code_permanant: studentContext.etudiant.code_permanant,
            sigle: cours.sigle,
            trimestre_reel: trimestre,
            annee: currentYear
          }
        });

        if (existingInscription) {
          results.push({
            ...cours,
            success: false,
            error: 'Déjà inscrit à ce cours'
          });
          continue;
        }

        // Create inscription
        await this.prisma.inscription.create({
          data: {
            code_permanant: studentContext.etudiant.code_permanant,
            code_programme: studentContext.etudiant.code_programme,
            trimestre: planExists.trimestre,
            sigle: cours.sigle,
            trimestre_reel: trimestre,
            annee: currentYear,
            statut_inscription: 'Inscrit'
          }
        });

        results.push({ ...cours, success: true });
      } catch (error) {
        results.push({ ...cours, success: false, error: error.message });
      }
    }

    return { inscriptions: results, studentContext };
  }

  private async getAvailableCoursForStudent(codeProgramme: string, codePermanent: string): Promise<any[]> {
    // Get courses in the student's program that they're not already registered for
    return await this.prisma.cours.findMany({
      where: {
        plan_de_formation: {
          some: {
            code: codeProgramme
          }
        },
        NOT: {
          plan_de_formation: {
            some: {
              inscription: {
                some: {
                  code_permanant: codePermanent,
                  statut_inscription: 'Inscrit'
                }
              }
            }
          }
        }
      }
    });
  }

  private async aiSelectCours(availableCours: any[], studentContext: any, count: number): Promise<any[]> {
    // For now, just return the first few courses
    // You can enhance this with AI logic later
    return availableCours.slice(0, count);
  }

  private async handleViewCours(studentContext: any): Promise<any> {
    return {
      inscriptions_actuelles: studentContext?.inscriptions_actuelles || [],
      total_credits: studentContext?.total_credits || 0,
      etudiant: studentContext?.etudiant
    };
  }

  private async handleSearchCours(params: any): Promise<any> {
    const searchTerm = params.criteres_recherche || '';

    try {
      const courses = await this.prisma.cours.findMany({
        where: {
          OR: [
            { titre: { contains: searchTerm, mode: 'insensitive' } },
            { d_partement: { contains: searchTerm, mode: 'insensitive' } },
            { sigle: { startsWith: this.mapSearchTermToCode(searchTerm) } },
            { contenu: { contains: searchTerm, mode: 'insensitive' } },
            { objectifs: { contains: searchTerm, mode: 'insensitive' } }
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
      'programming': 'INF',
      'mathématiques': 'MTH',
      'mathematics': 'MTH',
      'math': 'MTH',
      'physique': 'PHY',
      'physics': 'PHY',
      'chimie': 'CHM',
      'chemistry': 'CHM',
      'français': 'FRA',
      'french': 'FRA',
      'anglais': 'ANG',
      'english': 'ANG',
      'histoire': 'HIS',
      'history': 'HIS',
      'économie': 'ECO',
      'economics': 'ECO',
      'gestion': 'ADM',
      'administration': 'ADM',
      'management': 'ADM'
    };

    return mappings[termLower] || termLower.toUpperCase().substring(0, 3);
  }

  private async handleStudentInfo(studentContext: any): Promise<any> {
    return studentContext;
  }

  private async handleDesinscription(params: any, studentContext: any): Promise<any> {
    // Implementation for dropping courses
    return { message: 'Fonctionnalité de désinscription à implémenter' };
  }

  private async generateContextualResponse(intent: any, results: any, studentContext?: any): Promise<string> {
    const { action } = intent;

    switch (action) {
      case 'VOIR_COURS':
        return this.formatCoursListResponse(results, studentContext);

      case 'INSCRIRE_COURS':
        return this.formatInscriptionResponse(results);

      case 'CHERCHER_COURS':
        return this.formatSearchResponse(results);

      case 'INFO_ETUDIANT':
        return this.formatStudentInfoResponse(studentContext);

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

  private formatInscriptionResponse(results: any): string {
    if (!results.inscriptions || results.inscriptions.length === 0) {
      return "Aucune inscription effectuée.";
    }

    const successful = results.inscriptions.filter((r: any) => r.success);
    const failed = results.inscriptions.filter((r: any) => !r.success);

    let response = '';

    if (successful.length > 0) {
      const successList = successful.map((r: any) => `${r.titre} (${r.sigle})`).join(', ');
      response += `✅ Inscrit avec succès: ${successList}`;
    }

    if (failed.length > 0) {
      const failList = failed.map((r: any) => `${r.titre || r.sigle}: ${r.error}`).join('\n• ');
      response += `\n\n❌ Échecs:\n• ${failList}`;
    }

    return response;
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