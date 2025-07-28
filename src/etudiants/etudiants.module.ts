import { Module } from '@nestjs/common';
import { EtudiantsController } from './etudiants.controller';
import { EtudiantsService } from './etudiants.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [EtudiantsController],
  providers: [EtudiantsService],
})
export class EtudiantsModule {}