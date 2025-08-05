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
      case 'RECOMMANDER_COURS':
        return await this.handleRecommendCours(parametres, studentContext);

      case 'INSCRIRE_COURS':
        return await this.handleInscription(parametres, studentContext);

      case 'DESINSCRIRE_COURS':  // Add this new case
        return await this.handleDesinscription(parametres, studentContext);

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
      const trimestre = params.trimestre || null;

      let courses;

      if (trimestre) {
        // Search courses offered in specific trimester
        const horaireResults = await this.databaseService.horaire_des_cours.findMany({
          where: {
            trimestre: {
              contains: this.mapTrimestreToCode(trimestre)
            }
          },
          include: {
            cours: true
          }
        });

        // Filter by search term if provided
        courses = horaireResults
          .map(h => ({
            ...h.cours,
            horaire_info: {
              trimestre: h.trimestre,
              enseignants: h.enseignants,
              lieu: h.lieu,
              horaire: h.horaire,
              mode_enseignement: h.mode_enseignement
            }
          }))
          .filter(cours => {
            if (!searchTerm) return true;
            return (
              cours.titre?.includes(searchTerm) ||
              cours.d_partement?.includes(searchTerm) ||
              cours.sigle?.includes(searchTerm) ||
              cours.sigle?.startsWith(this.mapSearchTermToCode(searchTerm))
            );
          });
      } else {
        // Regular course search without trimester filter
        courses = await this.databaseService.cours.findMany({
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
      }

      return courses;
    } catch (error) {
      this.logger.error('Search error:', error);
      return [];
    }
  }

  private mapTrimestreToCode(trimestre: string): string {
    const trimLower = trimestre.toLowerCase();

    // Extract year if mentioned
    const yearMatch = trimestre.match(/20(\d{2})/);
    const year = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();

    const mappings: { [key: string]: string } = {
      'automne': `Automne ${year}`,
      'hiver': `Hiver ${year}`,
      'été': `Été ${year}`,
      'ete': `Été ${year}`,
      'summer': `Été ${year}`,
      'fall': `Automne ${year}`,
      'winter': `Hiver ${year}`,
      'printemps': `Hiver ${year}`, // Assuming spring = winter semester
      'spring': `Hiver ${year}`
    };

    // Check for direct matches
    for (const [key, value] of Object.entries(mappings)) {
      if (trimLower.includes(key)) {
        return value;
      }
    }

    // Check if it's already in the correct format
    if (trimestre.match(/^(Automne|Hiver|Été) \d{4}$/)) {
      return trimestre;
    }

    return trimestre; // Return as-is if no mapping found
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

  private async handleRecommendCours(params: any, studentContext: any): Promise<any> {
    if (!studentContext?.etudiant) {
      throw new Error('Étudiant non trouvé pour les recommandations');
    }

    try {
      const codeProgramme = studentContext.etudiant.code_programme;
      const codeEtudiant = studentContext.etudiant.code_permanant;

      // Get courses from student's program that they haven't taken yet
      const availableCoursesInProgram = await this.databaseService.cours.findMany({
        where: {
          plan_de_formation: {
            some: {
              code: codeProgramme  // Courses in their program
            }
          }
        },
        include: {
          plan_de_formation: {
            where: { code: codeProgramme }
          }
        }
      });

      // For now, return the first few courses as recommendations
      const numberOfCourses = params.nombre_cours || 4;
      const recommendedCourses = availableCoursesInProgram.slice(0, numberOfCourses);

      return {
        programme: codeProgramme,
        courses_recommandees: recommendedCourses,
        total_disponibles: availableCoursesInProgram.length,
        recommandation_personnalisee: true
      };
    } catch (error) {
      this.logger.error('Recommendation error:', error);
      return {
        error: 'Erreur lors de la génération des recommandations',
        programme: studentContext?.etudiant?.code_programme || 'inconnu'
      };
    }
  }

  private async handleInscription(params: any, studentContext: any): Promise<any> {
    if (!studentContext?.etudiant) {
      throw new Error('Étudiant non trouvé');
    }

    const etudiant = studentContext.etudiant;
    const sigles = params.sigles_cours || [];
    const trimestre = params.trimestre || params.trimestre_reel;
    const annee = params.annee || new Date().getFullYear();

    if (!sigles || sigles.length === 0) {
      throw new Error('Aucun sigle de cours spécifié');
    }

    if (!trimestre) {
      throw new Error('Trimestre non spécifié');
    }

    const results = [];

    for (const sigle of sigles) {
      try {
        // Step 1: Validate course exists
        const cours = await this.databaseService.cours.findUnique({
          where: { sigle: sigle }
        });

        if (!cours) {
          results.push({
            sigle: sigle,
            success: false,
            error: 'Cours inexistant'
          });
          continue;
        }

        // Step 2: Validate course is in student's program
        const courseInProgram = await this.databaseService.plan_de_formation.findFirst({
          where: {
            code: etudiant.code_programme,
            sigle: sigle
          }
        });

        if (!courseInProgram) {
          results.push({
            sigle: sigle,
            titre: cours.titre,
            success: false,
            error: `Cours non disponible dans votre programme ${etudiant.code_programme}`
          });
          continue;
        }

        // Step 3: Validate course is offered in the specified trimester
        const courseSchedule = await this.databaseService.horaire_des_cours.findFirst({
          where: {
            sigle: sigle,
            trimestre: trimestre
          }
        });

        if (!courseSchedule) {
          results.push({
            sigle: sigle,
            titre: cours.titre,
            success: false,
            error: `Cours non offert au trimestre ${trimestre}`
          });
          continue;
        }

        // Step 4: Check if already registered
        const existingInscription = await this.databaseService.inscription.findFirst({
          where: {
            code_permanant: etudiant.code_permanant,
            sigle: sigle,
            trimestre_reel: trimestre,
            annee: annee
          }
        });

        if (existingInscription) {
          results.push({
            sigle: sigle,
            titre: cours.titre,
            success: false,
            error: 'Déjà inscrit à ce cours pour ce trimestre'
          });
          continue;
        }

        // Step 5: Validate prerequisites
        const prerequisitesValid = await this.validatePrerequisites(etudiant.code_permanant, cours);

        if (!prerequisitesValid.valid) {
          results.push({
            sigle: sigle,
            titre: cours.titre,
            success: false,
            error: `Préalables non satisfaits: ${prerequisitesValid.missing.join(', ')}`
          });
          continue;
        }

        // Step 6: CREATE THE INSCRIPTION - This is the actual database insertion
        const newInscription = await this.databaseService.inscription.create({
          data: {
            code_permanant: etudiant.code_permanant,
            code_programme: etudiant.code_programme,
            trimestre: courseInProgram.trimestre,
            sigle: sigle,
            trimestre_reel: trimestre,
            annee: annee,
            statut_inscription: 'Inscrit'
          }
        });

        results.push({
          sigle: sigle,
          titre: cours.titre,
          credits: cours.cr_dits,
          trimestre: trimestre,
          success: true,
          inscription_id: newInscription.id,
          message: 'Inscription réussie'
        });

      } catch (error) {
        results.push({
          sigle: sigle,
          success: false,
          error: `Erreur d'inscription: ${error.message}`
        });
      }
    }

    return {
      etudiant: etudiant,
      trimestre: trimestre,
      inscriptions: results,
      inscriptions_reussies: results.filter(r => r.success).length,
      inscriptions_echouees: results.filter(r => !r.success).length
    };
  }

  private async handleDesinscription(params: any, studentContext: any): Promise<any> {
    if (!studentContext?.etudiant) {
      throw new Error('Étudiant non trouvé');
    }

    const etudiant = studentContext.etudiant;
    const sigles = params.sigles_cours || [];
    const trimestre = params.trimestre || params.trimestre_reel;
    const annee = params.annee || new Date().getFullYear();

    if (!sigles || sigles.length === 0) {
      throw new Error('Aucun sigle de cours spécifié pour la désinscription');
    }

    const results = [];

    for (const sigle of sigles) {
      try {
        // Step 1: Find existing inscription
        const whereClause: any = {
          code_permanant: etudiant.code_permanant,
          sigle: sigle,
          statut_inscription: 'Inscrit'
        };

        // Add trimester filter if specified
        if (trimestre) {
          whereClause.trimestre_reel = trimestre;
          whereClause.annee = annee;
        }

        const existingInscriptions = await this.databaseService.inscription.findMany({
          where: whereClause,
          include: {
            plan_de_formation: {
              include: {
                cours: true
              }
            }
          }
        });

        if (!existingInscriptions || existingInscriptions.length === 0) {
          results.push({
            sigle: sigle,
            success: false,
            error: trimestre
              ? `Aucune inscription trouvée pour ${sigle} au trimestre ${trimestre}`
              : `Aucune inscription active trouvée pour ${sigle}`
          });
          continue;
        }

        // If multiple inscriptions found (shouldn't happen but just in case)
        let inscriptionToRemove = existingInscriptions[0];

        // If trimester specified, find the exact match
        if (trimestre && existingInscriptions.length > 1) {
          const exactMatch = existingInscriptions.find(i =>
            i.trimestre_reel === trimestre && i.annee === annee
          );
          if (exactMatch) {
            inscriptionToRemove = exactMatch;
          }
        }

        // Step 2: Check withdrawal deadline (optional business rule)
        const canWithdraw = await this.validateWithdrawalDeadline(inscriptionToRemove);

        if (!canWithdraw.allowed) {
          results.push({
            sigle: sigle,
            titre: inscriptionToRemove.plan_de_formation.cours.titre,
            success: false,
            error: canWithdraw.reason
          });
          continue;
        }

        // Step 3: DELETE THE INSCRIPTION - This removes it from the database
        await this.databaseService.inscription.delete({
          where: {
            id: inscriptionToRemove.id
          }
        });

        results.push({
          sigle: sigle,
          titre: inscriptionToRemove.plan_de_formation.cours.titre,
          credits: inscriptionToRemove.plan_de_formation.cours.cr_dits,
          trimestre: inscriptionToRemove.trimestre_reel,
          success: true,
          inscription_id: inscriptionToRemove.id,
          message: 'Désinscription réussie'
        });

      } catch (error) {
        results.push({
          sigle: sigle,
          success: false,
          error: `Erreur de désinscription: ${error.message}`
        });
      }
    }

    return {
      etudiant: etudiant,
      trimestre: trimestre,
      desinscriptions: results,
      desinscriptions_reussies: results.filter(r => r.success).length,
      desinscriptions_echouees: results.filter(r => !r.success).length
    };
  }

  private async validateWithdrawalDeadline(inscription: any): Promise<{allowed: boolean, reason?: string}> {
    // This is a placeholder for withdrawal deadline validation
    // You can implement business rules here like:
    // - No withdrawal after certain date
    // - No withdrawal if course has started
    // - Different rules for different course types

    const now = new Date();
    const inscriptionDate = new Date(inscription.date_inscription);
    const daysSinceInscription = Math.floor((now.getTime() - inscriptionDate.getTime()) / (1000 * 60 * 60 * 24));

    // Example rule: Allow withdrawal within 30 days of inscription
    if (daysSinceInscription > 30) {
      return {
        allowed: false,
        reason: 'Délai de désinscription dépassé (plus de 30 jours)'
      };
    }

    return { allowed: true };
  }

  private async validatePrerequisites(codePermanent: string, cours: any): Promise<{valid: boolean, missing: string[]}> {
    if (!cours.pr_alables) {
      return { valid: true, missing: [] };
    }

    // Parse prerequisites from the course (this depends on how they're stored)
    // Assuming prerequisites are stored as comma-separated sigles
    const requiredCourses = cours.pr_alables
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.match(/[A-Z]{3}\d{4}/));

    if (requiredCourses.length === 0) {
      return { valid: true, missing: [] };
    }

    // Check which prerequisites the student has completed
    const completedCourses = await this.databaseService.inscription.findMany({
      where: {
        code_permanant: codePermanent,
        sigle: { in: requiredCourses },
        statut_inscription: 'Inscrit',
        note_finale: { gte: 50 } // Assuming 50+ is passing grade
      }
    });

    const completedSigles = completedCourses.map(c => c.sigle);
    const missingSigles = requiredCourses.filter(req => !completedSigles.includes(req));

    return {
      valid: missingSigles.length === 0,
      missing: missingSigles
    };
  }

  private async handleStudentInfo(studentContext: any): Promise<any> {
    return studentContext;
  }

  private async generateContextualResponse(intent: any, results: any, studentContext?: any): Promise<string> {
    const { action } = intent;

    switch (action) {
      case 'RECOMMANDER_COURS':
        return this.formatRecommendationResponse(results, studentContext);

      case 'VOIR_COURS':
        return this.formatCoursListResponse(results, studentContext);

      case 'CHERCHER_COURS':
        return this.formatSearchResponse(results);

      case 'INFO_ETUDIANT':
        return this.formatStudentInfoResponse(studentContext);

      case 'INSCRIRE_COURS':
        return this.formatInscriptionResponse(results);

      case 'DESINSCRIRE_COURS':  // Add this case
        return this.formatDesinscriptionResponse(results);

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

    // Check if results include trimester info
    const hasTrimestreInfo = results.some((c: any) => c.horaire_info);

    if (results.length > 10) {
      const first10 = results.slice(0, 10);
      const courseList = first10.map((c: any) => {
        if (hasTrimestreInfo && c.horaire_info) {
          return `${c.sigle} - ${c.titre} (${c.cr_dits} crédits)
  📅 ${c.horaire_info.trimestre} | 👨‍🏫 ${c.horaire_info.enseignants || 'N/A'}
  📍 ${c.horaire_info.lieu || 'N/A'} | 🏛️ ${c.d_partement}`;
        } else {
          return `${c.sigle} - ${c.titre} (${c.cr_dits} crédits) - ${c.d_partement}`;
        }
      }).join('\n\n');

      return `${results.length} cours trouvés. Voici les 10 premiers:\n\n${courseList}\n\n... et ${results.length - 10} autres cours.`;
    }

    const courseList = results.map((c: any) => {
      if (hasTrimestreInfo && c.horaire_info) {
        return `${c.sigle} - ${c.titre} (${c.cr_dits} crédits)
  📅 ${c.horaire_info.trimestre} | 👨‍🏫 ${c.horaire_info.enseignants || 'N/A'}
  📍 ${c.horaire_info.lieu || 'N/A'} | 🏛️ ${c.d_partement}`;
      } else {
        return `${c.sigle} - ${c.titre} (${c.cr_dits} crédits) - ${c.d_partement}`;
      }
    }).join('\n\n');

    const trimestreInfo = hasTrimestreInfo ? ' avec horaires' : '';
    return `${results.length} cours trouvé${results.length > 1 ? 's' : ''}${trimestreInfo}:\n\n${courseList}`;
  }

  private formatRecommendationResponse(results: any, studentContext: any): string {
    if (!results.courses_recommandees || results.courses_recommandees.length === 0) {
      return `Aucun cours recommandé trouvé pour le programme ${results.programme || 'N/A'}.`;
    }

    const etudiant = studentContext?.etudiant;
    let response = `🎓 Recommandations personnalisées pour ${etudiant?.prenom} ${etudiant?.nom}\n`;
    response += `📚 Programme: ${results.programme}\n\n`;
    response += `Cours recommandés:\n\n`;

    const courseList = results.courses_recommandees.map((cours: any, index: number) => {
      return `${index + 1}. ${cours.sigle} - ${cours.titre}
  📊 ${cours.cr_dits} crédits
  🏛️ ${cours.d_partement}`;
    }).join('\n\n');

    response += courseList;
    response += `\n\n📈 Total: ${results.courses_recommandees.length} cours recommandés sur ${results.total_disponibles} disponibles dans votre programme.`;

    return response;
  }

  private formatInscriptionResponse(results: any): string {
    if (!results.inscriptions || results.inscriptions.length === 0) {
      return "Aucune tentative d'inscription effectuée.";
    }

    const etudiant = results.etudiant;
    let response = `📚 Résultats d'inscription pour ${etudiant.prenom} ${etudiant.nom}\n`;
    response += `🎓 Programme: ${etudiant.code_programme} | 📅 Trimestre: ${results.trimestre}\n\n`;

    const successful = results.inscriptions.filter((r: any) => r.success);
    const failed = results.inscriptions.filter((r: any) => !r.success);

    if (successful.length > 0) {
      response += `✅ INSCRIPTIONS RÉUSSIES (${successful.length}):\n`;
      successful.forEach((r: any) => {
        response += `• ${r.sigle} - ${r.titre} (${r.credits} crédits)\n`;
        response += `  📝 ID: ${r.inscription_id}\n`;
      });
    }

    if (failed.length > 0) {
      response += `\n❌ INSCRIPTIONS ÉCHOUÉES (${failed.length}):\n`;
      failed.forEach((r: any) => {
        response += `• ${r.sigle}${r.titre ? ` - ${r.titre}` : ''}\n`;
        response += `  ⚠️ Raison: ${r.error}\n`;
      });
    }

    response += `\n📊 Résumé: ${results.inscriptions_reussies}/${results.inscriptions.length} inscriptions réussies`;

    return response;
  }

  private formatDesinscriptionResponse(results: any): string {
    if (!results.desinscriptions || results.desinscriptions.length === 0) {
      return "Aucune tentative de désinscription effectuée.";
    }

    const etudiant = results.etudiant;
    let response = `📚 Résultats de désinscription pour ${etudiant.prenom} ${etudiant.nom}\n`;
    response += `🎓 Programme: ${etudiant.code_programme}`;
    if (results.trimestre) {
      response += ` | 📅 Trimestre: ${results.trimestre}`;
    }
    response += `\n\n`;

    const successful = results.desinscriptions.filter((r: any) => r.success);
    const failed = results.desinscriptions.filter((r: any) => !r.success);

    if (successful.length > 0) {
      response += `✅ DÉSINSCRIPTIONS RÉUSSIES (${successful.length}):\n`;
      successful.forEach((r: any) => {
        response += `• ${r.sigle} - ${r.titre} (${r.credits} crédits)\n`;
        response += `  🗑️ Retiré de votre horaire\n`;
      });
    }

    if (failed.length > 0) {
      response += `\n❌ DÉSINSCRIPTIONS ÉCHOUÉES (${failed.length}):\n`;
      failed.forEach((r: any) => {
        response += `• ${r.sigle}${r.titre ? ` - ${r.titre}` : ''}\n`;
        response += `  ⚠️ Raison: ${r.error}\n`;
      });
    }

    response += `\n📊 Résumé: ${results.desinscriptions_reussies}/${results.desinscriptions.length} désinscriptions réussies`;

    return response;
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