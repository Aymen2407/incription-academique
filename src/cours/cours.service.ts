import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { cours } from "@prisma/client";

@Injectable()
export class CoursService {
  constructor(private readonly databaseService: DatabaseService) {
  }

  async getCoursBySigle(sigle: string): Promise<cours | {}> {
    try {
      if (!sigle || !sigle.trim()) {
        return {};
      }

      const result = await this.databaseService.$queryRaw<cours[]>`
            EXEC GetCoursBySigle @sigle = ${sigle}
        `;
      return result[0] || {};
    } catch (error) {
      console.error('Error executing stored procedure:', error);
      throw error;
    }
  }

  async getAllCours(): Promise<cours[]> {
    return this.databaseService.$queryRaw<cours[]>`EXEC GetAllCours`;
  }
}
