import { Module } from "@nestjs/common";

import { HoraireDesCoursController } from "./horaire_des_cours.controller";
import { HoraireDesCoursService } from "./horaire_des_cours.service";
import { DatabaseModule } from "../database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [HoraireDesCoursController],
  providers: [HoraireDesCoursService]
})
export class HoraireDesCoursModule {
}