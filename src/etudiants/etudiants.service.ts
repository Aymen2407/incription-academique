import { Injectable } from '@nestjs/common';
import { DatabaseService } from "../database/database.service";
import { cours, etudiants } from "@prisma/client";


@Injectable()
export class EtudiantsService {

  constructor(private readonly databaseService: DatabaseService){}


  async getEtudiantById(code): Promise<etudiants | {}> {
    try {
      if (!code || !code.trim()) {
        return {};
      }

      const result = await this.databaseService.$queryRaw<etudiants[]>`
            EXEC GetEtudiantById @code = ${code}
        `;
      return result[0] || {};
    } catch (error) {
      console.error('Error executing stored procedure:', error);
      throw error;
    }
  }


  async getAllEtudiants(): Promise<etudiants[]>  {
    return this.databaseService.$queryRaw<etudiants[]>`
    EXEC GetAllEtudiants
  `;
  }
}
