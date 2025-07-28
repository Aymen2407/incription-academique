import { Controller, Get, Query } from "@nestjs/common";
import { EtudiantsService } from "./etudiants.service";
import console from "console";

@Controller("etudiants")
export class EtudiantsController {
  constructor(private readonly etudiantsService: EtudiantsService) {
  }


  @Get()
  async getEtudiants(@Query("code") code ?: string) {
    if (code) {
      return await this.etudiantsService.getEtudiantById(code);
    } else {
      return await this.etudiantsService.getAllEtudiants();
    }
  }

}
