import { Module } from '@nestjs/common';
import { CoursModule } from './cours/cours.module';
import { EtudiantsModule } from './etudiants/etudiants.module';
import { HoraireDesCoursModule } from './horaire_des_cours/horaire_des_cours.module';
import { AIModule } from './ai/ai.module';

@Module({
  imports: [
    CoursModule,
    EtudiantsModule,
    HoraireDesCoursModule,
    AIModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}