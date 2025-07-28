import { Controller, Get, Query } from "@nestjs/common";
import console from "console";
import { CoursService } from "./cours.service";

@Controller("cours")
export class CoursController {
  constructor(private readonly coursService: CoursService) {
  }

  @Get()
  async getCourses(@Query("sigle") sigle ?: string) {
    if (sigle) {
      return await this.coursService.getCoursBySigle(sigle);
    } else {
      return await this.coursService.getAllCours();
    }
  }

}
