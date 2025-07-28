import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { horaire_des_cours } from "@prisma/client";

@Injectable()
export class HoraireDesCoursService {
  constructor(private readonly databaseService: DatabaseService) {
  }


  async getHoraireById(id): Promise<horaire_des_cours | {}> {
    try {

      if (!id || !id.trim()) {
        return {};
      }

      const numId = parseInt(id.trim());

      if (isNaN(numId) || numId <= 0) {
        return {};
      }

      const result = await this.databaseService.$queryRaw<horaire_des_cours[]>`
            EXEC GetHoraireById @id = ${id}
        `;
      return result[0] || {};
    } catch (error) {
      console.error("Error executing stored procedure:", error);
      throw error;
    }
  }


  async getAllHoraire() {
    return this.databaseService.$queryRaw<horaire_des_cours[]>`
    EXEC GetAllHoraire
  `;
  }
}
