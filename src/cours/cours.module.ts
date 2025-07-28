import { Module } from "@nestjs/common";

import { CoursController } from "./cours.controller";
import { CoursService } from "./cours.service";
import { DatabaseModule } from "../database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [CoursController],
  providers: [CoursService]
})
export class CoursModule {
}