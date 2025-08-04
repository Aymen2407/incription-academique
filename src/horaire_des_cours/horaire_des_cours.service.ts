import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { horaire_des_cours } from "@prisma/client";

@Injectable()
export class HoraireDesCoursService {
  constructor(private readonly databaseService: DatabaseService) {
  }

  async getHoraireById(id): Promise<horaire_des_cours | {}> {
    try {
      // Check if Sigle parameter is provided and valid
      if (!id || typeof id !== 'string' || !id.trim()) {
        return {};
      }

      const sigle = id.trim();

      // Validate Sigle length (varchar 20)
      if (sigle.length > 20) {
        return {};
      }

      // Optional: Add basic format validation for Sigle if needed
      // Example: if Sigle should contain only alphanumeric characters and hyphens
      // const siglePattern = /^[A-Za-z0-9-]+$/;
      // if (!siglePattern.test(sigle)) {
      //   return {};
      // }

      const result = await this.databaseService.$queryRaw<horaire_des_cours[]>`
            EXEC GetHoraireById @id = ${sigle}
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