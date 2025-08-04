import { Controller, Get, Query } from "@nestjs/common";
import console from "console";
import { HoraireDesCoursService } from "./horaire_des_cours.service";

@Controller("horaire-des-cours")
export class HoraireDesCoursController {
  constructor(private readonly horaireDesCoursService: HoraireDesCoursService) {}

  @Get()
  async getCourses(@Query("sigle") id ?: string) {
    if (id) {
      return await this.horaireDesCoursService.getHoraireById(id);
    } else {
      return this.horaireDesCoursService.getAllHoraire();
    }
  }



}
